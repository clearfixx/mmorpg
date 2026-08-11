import {
  ItemBinding,
  ItemLocation,
  ItemRarity,
  MarketListingStatus,
  ResourceType,
  type Prisma,
} from '@veilfall/database';
import { itemDamageRange } from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { equipmentSlotsForDefinition } from '../inventory/inventory.service';
import { itemDefinition } from '../inventory/item-catalog';
import type { InventoryItemModel } from '../inventory/models/inventory.model';
import { CreateMarketListingInput } from './dto/create-market-listing.input';
import { MarketListingCommandInput } from './dto/market-listing-command.input';
import type {
  MarketHistoryEntryModel,
  MarketplaceModel,
  MarketListingModel,
} from './models/marketplace.model';

const LISTING_DEPOSIT = 1;
const LISTING_DURATION_MS = 24 * 60 * 60 * 1_000;

type ListingWithItem = Prisma.MarketListingGetPayload<{
  include: { item: true };
}>;

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    await this.expireListings();
    return this.read(characterId);
  }

  async createListing(
    userId: string,
    input: CreateMarketListingInput,
  ): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = hash(`CREATE:${input.itemId}:${input.price}`);
    if (
      await this.resolveExisting(characterId, input.idempotencyKey, payloadHash)
    )
      return this.read(characterId);

    await this.prisma.client.$transaction(async (tx) => {
      const debited = await tx.characterResource.updateMany({
        where: {
          characterId,
          type: ResourceType.VEIL_ECHO,
          balance: { gte: LISTING_DEPOSIT },
        },
        data: { balance: { decrement: LISTING_DEPOSIT } },
      });
      if (debited.count !== 1)
        throw new ConflictException('A Veil Echo deposit is required');

      const reserved = await tx.itemInstance.updateMany({
        where: {
          id: input.itemId,
          ownerId: characterId,
          location: { in: [ItemLocation.CHEST, ItemLocation.BACKPACK] },
          binding: { not: ItemBinding.BOUND },
        },
        data: { location: ItemLocation.MARKET },
      });
      if (reserved.count !== 1)
        throw new BadRequestException('Item cannot be listed');

      const listing = await tx.marketListing.create({
        data: {
          sellerCharacterId: characterId,
          itemId: input.itemId,
          price: input.price,
          deposit: LISTING_DEPOSIT,
          expiresAt: new Date(Date.now() + LISTING_DURATION_MS),
        },
      });
      await tx.resourceLedgerEntry.create({
        data: {
          characterId,
          type: ResourceType.VEIL_ECHO,
          amount: -LISTING_DEPOSIT,
          reason: 'MARKET_DEPOSIT',
          referenceId: listing.id,
        },
      });
      await tx.marketCommand.create({
        data: {
          characterId,
          listingId: listing.id,
          idempotencyKey: input.idempotencyKey,
          commandType: 'CREATE_LISTING',
          payloadHash,
        },
      });
    });
    return this.read(characterId);
  }

  async cancelListing(
    userId: string,
    input: MarketListingCommandInput,
  ): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = hash(`CANCEL:${input.listingId}`);
    if (
      await this.resolveExisting(characterId, input.idempotencyKey, payloadHash)
    )
      return this.read(characterId);

    await this.prisma.client.$transaction(async (tx) => {
      const listing = await tx.marketListing.findFirst({
        where: {
          id: input.listingId,
          sellerCharacterId: characterId,
          status: MarketListingStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });
      if (!listing) throw new BadRequestException('Listing is unavailable');
      const cancelled = await tx.marketListing.updateMany({
        where: { id: listing.id, status: MarketListingStatus.ACTIVE },
        data: {
          status: MarketListingStatus.CANCELLED,
          completedAt: new Date(),
        },
      });
      if (cancelled.count !== 1) throw new ConflictException('Listing changed');
      await tx.itemInstance.update({
        where: { id: listing.itemId },
        data: { location: ItemLocation.CHEST },
      });
      await tx.marketCommand.create({
        data: {
          characterId,
          listingId: listing.id,
          idempotencyKey: input.idempotencyKey,
          commandType: 'CANCEL_LISTING',
          payloadHash,
        },
      });
    });
    return this.read(characterId);
  }

  async buyListing(
    userId: string,
    input: MarketListingCommandInput,
  ): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = hash(`BUY:${input.listingId}`);
    if (
      await this.resolveExisting(characterId, input.idempotencyKey, payloadHash)
    )
      return this.read(characterId);

    await this.prisma.client.$transaction(async (tx) => {
      const listing = await tx.marketListing.findFirst({
        where: {
          id: input.listingId,
          status: MarketListingStatus.ACTIVE,
          expiresAt: { gt: new Date() },
          sellerCharacterId: { not: characterId },
        },
      });
      if (!listing) throw new BadRequestException('Listing is unavailable');
      const claimed = await tx.marketListing.updateMany({
        where: { id: listing.id, status: MarketListingStatus.ACTIVE },
        data: {
          status: MarketListingStatus.SOLD,
          buyerCharacterId: characterId,
          completedAt: new Date(),
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Listing was sold');

      const paid = await tx.characterResource.updateMany({
        where: {
          characterId,
          type: ResourceType.VEIL_ECHO,
          balance: { gte: listing.price },
        },
        data: { balance: { decrement: listing.price } },
      });
      if (paid.count !== 1)
        throw new ConflictException('Not enough Veil Echoes');
      await tx.characterResource.upsert({
        where: {
          characterId_type: {
            characterId: listing.sellerCharacterId,
            type: ResourceType.VEIL_ECHO,
          },
        },
        create: {
          characterId: listing.sellerCharacterId,
          type: ResourceType.VEIL_ECHO,
          balance: listing.price + listing.deposit,
        },
        update: { balance: { increment: listing.price + listing.deposit } },
      });
      await tx.itemInstance.update({
        where: { id: listing.itemId },
        data: {
          ownerId: characterId,
          location: ItemLocation.CHEST,
        },
      });
      await tx.resourceLedgerEntry.createMany({
        data: [
          {
            characterId,
            type: ResourceType.VEIL_ECHO,
            amount: -listing.price,
            reason: 'MARKET_PURCHASE',
            referenceId: listing.id,
          },
          {
            characterId: listing.sellerCharacterId,
            type: ResourceType.VEIL_ECHO,
            amount: listing.price + listing.deposit,
            reason: 'MARKET_SALE',
            referenceId: listing.id,
          },
        ],
      });
      await tx.marketCommand.create({
        data: {
          characterId,
          listingId: listing.id,
          idempotencyKey: input.idempotencyKey,
          commandType: 'BUY_LISTING',
          payloadHash,
        },
      });
    });
    return this.read(characterId);
  }

  private async expireListings(): Promise<void> {
    const expired = await this.prisma.client.marketListing.findMany({
      where: {
        status: MarketListingStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      select: { id: true, itemId: true },
      take: 100,
    });
    if (!expired.length) return;
    await this.prisma.client.$transaction(async (tx) => {
      for (const listing of expired) {
        const updated = await tx.marketListing.updateMany({
          where: { id: listing.id, status: MarketListingStatus.ACTIVE },
          data: {
            status: MarketListingStatus.EXPIRED,
            completedAt: new Date(),
          },
        });
        if (updated.count === 1)
          await tx.itemInstance.update({
            where: { id: listing.itemId },
            data: { location: ItemLocation.CHEST },
          });
      }
    });
  }

  private async read(characterId: string): Promise<MarketplaceModel> {
    const [balance, active, mine, history] = await Promise.all([
      this.prisma.client.characterResource.findUnique({
        where: {
          characterId_type: { characterId, type: ResourceType.VEIL_ECHO },
        },
      }),
      this.prisma.client.marketListing.findMany({
        where: {
          status: MarketListingStatus.ACTIVE,
          expiresAt: { gt: new Date() },
          sellerCharacterId: { not: characterId },
        },
        include: { item: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.client.marketListing.findMany({
        where: {
          sellerCharacterId: characterId,
          status: MarketListingStatus.ACTIVE,
        },
        include: { item: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.marketListing.findMany({
        where: {
          status: { not: MarketListingStatus.ACTIVE },
          OR: [
            { sellerCharacterId: characterId },
            { buyerCharacterId: characterId },
          ],
        },
        include: { item: true },
        orderBy: { completedAt: 'desc' },
        take: 30,
      }),
    ]);
    return {
      balance: balance?.balance ?? 0,
      listingDeposit: LISTING_DEPOSIT,
      listings: active.map((listing) => this.listing(listing, false)),
      myListings: mine.map((listing) => this.listing(listing, true)),
      history: history.map((listing) => this.history(listing, characterId)),
    };
  }

  private listing(listing: ListingWithItem, own: boolean): MarketListingModel {
    return {
      id: listing.id,
      item: marketItem(listing.item),
      price: listing.price,
      deposit: listing.deposit,
      status: listing.status,
      expiresAt: listing.expiresAt,
      createdAt: listing.createdAt,
      own,
    };
  }

  private history(
    listing: ListingWithItem,
    characterId: string,
  ): MarketHistoryEntryModel {
    return {
      id: listing.id,
      item: marketItem(listing.item),
      price: listing.price,
      status: listing.status,
      role: listing.sellerCharacterId === characterId ? 'SELLER' : 'BUYER',
      completedAt: listing.completedAt ?? listing.expiresAt,
    };
  }

  private async resolveExisting(
    characterId: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<boolean> {
    const existing = await this.prisma.client.marketCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
    if (!existing) return false;
    if (existing.payloadHash !== payloadHash)
      throw new ConflictException('Market command key was already used');
    return true;
  }
}

function marketItem(item: {
  id: string;
  definitionId: string;
  itemLevel: number;
  rarity: ItemRarity;
  rollQuality: number;
  damage: number;
  armor: number;
  health: number;
  binding: ItemBinding;
  visualAssetId: string;
}): InventoryItemModel {
  const definition = itemDefinition(item.definitionId);
  if (!definition) throw new ConflictException('Item definition is missing');
  const range = itemDamageRange(item.itemLevel, item.rarity);
  return {
    ...item,
    damageMin: range.min,
    damageMax: range.max,
    compatibleSlots: equipmentSlotsForDefinition(item.definitionId),
    name: definition.name,
    setName: definition.setName,
  };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

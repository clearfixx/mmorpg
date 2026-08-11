import {
  ItemBinding,
  ItemLocation,
  ItemRarity,
  MarketListingStatus,
  ResourceType,
  type Prisma,
} from '@veilfall/database';
import {
  itemDamageRange,
  minimumEquipmentMarketPrice,
  minimumResourceMarketPrice,
  resourceDefinition,
} from '@veilfall/game-engine';
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
import { resourceBalance } from '../resources/resource-catalog';
import { CreateMarketListingInput } from './dto/create-market-listing.input';
import { CreateMarketResourceListingInput } from './dto/create-market-resource-listing.input';
import type { MarketBrowseInput, MarketSort } from './dto/market-browse.input';
import { MarketListingCommandInput } from './dto/market-listing-command.input';
import type {
  MarketHistoryEntryModel,
  MarketplaceModel,
  MarketListingModel,
} from './models/marketplace.model';

const LISTING_DEPOSIT = 1;
const LISTING_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAX_ACTIVE_LISTINGS = 20;

type ListingWithItem = Prisma.MarketListingGetPayload<{
  include: { item: true };
}>;

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(
    userId: string,
    input?: MarketBrowseInput,
  ): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    await this.expireListings();
    return this.read(characterId, input);
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
      await this.assertListingCapacity(tx, characterId);
      const item = await tx.itemInstance.findFirst({
        where: {
          id: input.itemId,
          ownerId: characterId,
          location: { in: [ItemLocation.CHEST, ItemLocation.BACKPACK] },
          binding: { not: ItemBinding.BOUND },
        },
      });
      if (!item) throw new BadRequestException('Item cannot be listed');
      const minimumPrice = minimumEquipmentMarketPrice(
        item.itemLevel,
        item.rarity,
      );
      if (input.price < minimumPrice)
        throw new BadRequestException(`Minimum price is ${minimumPrice}`);
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

  async createResourceListing(
    userId: string,
    input: CreateMarketResourceListingInput,
  ): Promise<MarketplaceModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    if (input.resourceType === ResourceType.VEIL_ECHO)
      throw new BadRequestException('Market currency cannot be listed');
    const definition = resourceDefinition(input.resourceType);
    if (!definition.tradeable)
      throw new BadRequestException('Resource cannot be traded');
    const minimumPrice = minimumResourceMarketPrice(
      input.resourceType,
      input.amount,
    );
    if (input.price < minimumPrice)
      throw new BadRequestException(`Minimum price is ${minimumPrice}`);
    const payloadHash = hash(
      `CREATE_RESOURCE:${input.resourceType}:${input.amount}:${input.price}`,
    );
    if (
      await this.resolveExisting(characterId, input.idempotencyKey, payloadHash)
    )
      return this.read(characterId);

    await this.prisma.client.$transaction(async (tx) => {
      await this.assertListingCapacity(tx, characterId);
      const deposit = await tx.characterResource.updateMany({
        where: {
          characterId,
          type: ResourceType.VEIL_ECHO,
          balance: { gte: LISTING_DEPOSIT },
        },
        data: { balance: { decrement: LISTING_DEPOSIT } },
      });
      if (deposit.count !== 1)
        throw new ConflictException('A Veil Echo deposit is required');
      const reserved = await tx.characterResource.updateMany({
        where: {
          characterId,
          type: input.resourceType,
          balance: { gte: input.amount },
        },
        data: { balance: { decrement: input.amount } },
      });
      if (reserved.count !== 1)
        throw new ConflictException('Not enough resources for this lot');
      const listing = await tx.marketListing.create({
        data: {
          sellerCharacterId: characterId,
          resourceType: input.resourceType,
          resourceAmount: input.amount,
          price: input.price,
          deposit: LISTING_DEPOSIT,
          expiresAt: new Date(Date.now() + LISTING_DURATION_MS),
        },
      });
      await tx.resourceLedgerEntry.createMany({
        data: [
          {
            characterId,
            type: ResourceType.VEIL_ECHO,
            amount: -LISTING_DEPOSIT,
            reason: 'MARKET_DEPOSIT',
            referenceId: listing.id,
          },
          {
            characterId,
            type: input.resourceType,
            amount: -input.amount,
            reason: 'MARKET_RESERVE',
            referenceId: listing.id,
          },
        ],
      });
      await tx.marketCommand.create({
        data: {
          characterId,
          listingId: listing.id,
          idempotencyKey: input.idempotencyKey,
          commandType: 'CREATE_RESOURCE_LISTING',
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
      if (listing.itemId) {
        await tx.itemInstance.update({
          where: { id: listing.itemId },
          data: { location: ItemLocation.CHEST },
        });
      } else if (listing.resourceType && listing.resourceAmount) {
        await tx.characterResource.upsert({
          where: {
            characterId_type: {
              characterId,
              type: listing.resourceType,
            },
          },
          create: {
            characterId,
            type: listing.resourceType,
            balance: listing.resourceAmount,
          },
          update: { balance: { increment: listing.resourceAmount } },
        });
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type: listing.resourceType,
            amount: listing.resourceAmount,
            reason: 'MARKET_RETURN',
            referenceId: listing.id,
          },
        });
      }
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
      if (listing.itemId) {
        await tx.itemInstance.update({
          where: { id: listing.itemId },
          data: {
            ownerId: characterId,
            location: ItemLocation.CHEST,
          },
        });
      } else if (listing.resourceType && listing.resourceAmount) {
        await tx.characterResource.upsert({
          where: {
            characterId_type: {
              characterId,
              type: listing.resourceType,
            },
          },
          create: {
            characterId,
            type: listing.resourceType,
            balance: listing.resourceAmount,
          },
          update: { balance: { increment: listing.resourceAmount } },
        });
      } else {
        throw new ConflictException('Listing asset is missing');
      }
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
          ...(listing.resourceType && listing.resourceAmount
            ? [
                {
                  characterId,
                  type: listing.resourceType,
                  amount: listing.resourceAmount,
                  reason: 'MARKET_RESOURCE_PURCHASE',
                  referenceId: listing.id,
                },
              ]
            : []),
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
      select: {
        id: true,
        itemId: true,
        sellerCharacterId: true,
        resourceType: true,
        resourceAmount: true,
      },
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
        if (updated.count !== 1) continue;
        if (listing.itemId) {
          await tx.itemInstance.update({
            where: { id: listing.itemId },
            data: { location: ItemLocation.CHEST },
          });
        } else if (listing.resourceType && listing.resourceAmount) {
          await tx.characterResource.upsert({
            where: {
              characterId_type: {
                characterId: listing.sellerCharacterId,
                type: listing.resourceType,
              },
            },
            create: {
              characterId: listing.sellerCharacterId,
              type: listing.resourceType,
              balance: listing.resourceAmount,
            },
            update: { balance: { increment: listing.resourceAmount } },
          });
          await tx.resourceLedgerEntry.create({
            data: {
              characterId: listing.sellerCharacterId,
              type: listing.resourceType,
              amount: listing.resourceAmount,
              reason: 'MARKET_RETURN',
              referenceId: listing.id,
            },
          });
        }
      }
    });
  }

  private async read(
    characterId: string,
    input?: MarketBrowseInput,
  ): Promise<MarketplaceModel> {
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
        take: 200,
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
    const visible = active
      .map((listing) => this.listing(listing, false))
      .filter((listing) => matchesBrowse(listing, input))
      .sort((left, right) => compareListings(left, right, input?.sort))
      .slice(0, 50);
    return {
      balance: balance?.balance ?? 0,
      listingDeposit: LISTING_DEPOSIT,
      listings: visible,
      myListings: mine.map((listing) => this.listing(listing, true)),
      history: history.map((listing) => this.history(listing, characterId)),
    };
  }

  private listing(listing: ListingWithItem, own: boolean): MarketListingModel {
    const item = listing.item ? marketItem(listing.item) : null;
    const resource =
      listing.resourceType && listing.resourceAmount
        ? resourceBalance(listing.resourceType, listing.resourceAmount)
        : null;
    return {
      id: listing.id,
      item,
      resource,
      price: listing.price,
      deposit: listing.deposit,
      minimumPrice: item
        ? minimumEquipmentMarketPrice(item.itemLevel, item.rarity as ItemRarity)
        : resource
          ? minimumResourceMarketPrice(resource.type, resource.amount)
          : 1,
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
      item: listing.item ? marketItem(listing.item) : null,
      resource:
        listing.resourceType && listing.resourceAmount
          ? resourceBalance(listing.resourceType, listing.resourceAmount)
          : null,
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

  private async assertListingCapacity(
    tx: Prisma.TransactionClient,
    characterId: string,
  ): Promise<void> {
    const active = await tx.marketListing.count({
      where: {
        sellerCharacterId: characterId,
        status: MarketListingStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
    });
    if (active >= MAX_ACTIVE_LISTINGS)
      throw new ConflictException('Active listing limit reached');
  }
}

function matchesBrowse(
  listing: MarketListingModel,
  input?: MarketBrowseInput,
): boolean {
  if (input?.kind === 'EQUIPMENT' && !listing.item) return false;
  if (input?.kind === 'RESOURCE' && !listing.resource) return false;
  const search = input?.search?.trim().toLocaleLowerCase('uk-UA');
  if (!search) return true;
  return (
    listing.item?.name.toLocaleLowerCase('uk-UA').includes(search) === true ||
    listing.resource?.name.toLocaleLowerCase('uk-UA').includes(search) === true
  );
}

function compareListings(
  left: MarketListingModel,
  right: MarketListingModel,
  sort: MarketSort = 'NEWEST',
): number {
  if (sort === 'PRICE_ASC') return left.price - right.price;
  if (sort === 'PRICE_DESC') return right.price - left.price;
  if (sort === 'ENDING')
    return left.expiresAt.getTime() - right.expiresAt.getTime();
  return right.createdAt.getTime() - left.createdAt.getTime();
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

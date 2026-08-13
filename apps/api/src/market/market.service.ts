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
  MARKET_SALE_FEE_PERCENT,
  marketSaleFee,
  marketSellerProceeds,
  medianMarketPrice,
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
import { MarketQuoteInput } from './dto/market-quote.input';
import type {
  MarketHistoryEntryModel,
  MarketplaceModel,
  MarketListingModel,
  MarketQuoteModel,
} from './models/marketplace.model';

const LISTING_DEPOSIT = 1;
const LISTING_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAX_ACTIVE_LISTINGS = 20;
const MARKET_PAGE_SIZE = 20;

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

  async quote(
    userId: string,
    input: MarketQuoteInput,
  ): Promise<MarketQuoteModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    if (Boolean(input.itemId) === Boolean(input.resourceType))
      throw new BadRequestException('Choose exactly one market asset');

    let minimumPrice: number;
    let key: string;
    let amount = 1;
    if (input.itemId) {
      const item = await this.prisma.client.itemInstance.findFirst({
        where: {
          id: input.itemId,
          ownerId: characterId,
          location: { in: [ItemLocation.CHEST, ItemLocation.BACKPACK] },
          binding: { not: ItemBinding.BOUND },
        },
      });
      if (!item) throw new BadRequestException('Item cannot be quoted');
      minimumPrice = minimumEquipmentMarketPrice(item.itemLevel, item.rarity);
      key = `ITEM:${item.definitionId}:${item.rarity}`;
    } else {
      const resourceType = input.resourceType!;
      amount = input.amount ?? 1;
      if (resourceType === ResourceType.VEIL_ECHO)
        throw new BadRequestException('Market currency cannot be listed');
      if (!resourceDefinition(resourceType).tradeable)
        throw new BadRequestException('Resource cannot be traded');
      minimumPrice = minimumResourceMarketPrice(resourceType, amount);
      key = `RESOURCE:${resourceType}`;
    }

    const recentSales = await this.prisma.client.marketListing.findMany({
      where: { status: MarketListingStatus.SOLD },
      include: { item: true },
      orderBy: { completedAt: 'desc' },
      take: 500,
    });
    const comparable = buildPriceGuide(recentSales).get(key) ?? [];
    const unitReference = medianMarketPrice(comparable);
    const referencePrice =
      unitReference === null ? null : unitReference * amount;
    const quotePrice = referencePrice ?? minimumPrice;
    return {
      minimumPrice,
      referencePrice,
      comparableSales: comparable.length,
      saleFeePercent: MARKET_SALE_FEE_PERCENT,
      saleFeeAtReference: marketSaleFee(quotePrice),
      proceedsAtReference: marketSellerProceeds(quotePrice),
    };
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
      const saleFee = marketSaleFee(listing.price);
      const sellerProceeds = marketSellerProceeds(listing.price);
      const claimed = await tx.marketListing.updateMany({
        where: { id: listing.id, status: MarketListingStatus.ACTIVE },
        data: {
          status: MarketListingStatus.SOLD,
          buyerCharacterId: characterId,
          saleFee,
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
          balance: sellerProceeds + listing.deposit,
        },
        update: { balance: { increment: sellerProceeds + listing.deposit } },
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
          {
            characterId: listing.sellerCharacterId,
            type: ResourceType.VEIL_ECHO,
            amount: -saleFee,
            reason: 'MARKET_SALE_FEE',
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
    const [
      balance,
      active,
      mine,
      history,
      recentSales,
      sellerStats,
      buyerStats,
    ] = await Promise.all([
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
      this.prisma.client.marketListing.findMany({
        where: { status: MarketListingStatus.SOLD },
        include: { item: true },
        orderBy: { completedAt: 'desc' },
        take: 500,
      }),
      this.prisma.client.marketListing.aggregate({
        where: {
          status: MarketListingStatus.SOLD,
          sellerCharacterId: characterId,
        },
        _count: { _all: true },
        _sum: { price: true, saleFee: true },
      }),
      this.prisma.client.marketListing.aggregate({
        where: {
          status: MarketListingStatus.SOLD,
          buyerCharacterId: characterId,
        },
        _count: { _all: true },
        _sum: { price: true },
      }),
    ]);
    const priceGuide = buildPriceGuide(recentSales);
    const filtered = active
      .map((listing) => this.listing(listing, false, priceGuide))
      .filter((listing) => matchesBrowse(listing, input))
      .sort((left, right) => compareListings(left, right, input?.sort));
    const totalListings = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalListings / MARKET_PAGE_SIZE));
    const page = Math.min(Math.max(1, input?.page ?? 1), totalPages);
    const visible = filtered.slice(
      (page - 1) * MARKET_PAGE_SIZE,
      page * MARKET_PAGE_SIZE,
    );
    return {
      balance: balance?.balance ?? 0,
      listingDeposit: LISTING_DEPOSIT,
      saleFeePercent: MARKET_SALE_FEE_PERCENT,
      page,
      totalPages,
      totalListings,
      stats: {
        purchases: buyerStats._count._all,
        sales: sellerStats._count._all,
        spent: buyerStats._sum.price ?? 0,
        earned: (sellerStats._sum.price ?? 0) - (sellerStats._sum.saleFee ?? 0),
        feesPaid: sellerStats._sum.saleFee ?? 0,
      },
      listings: visible,
      myListings: mine.map((listing) =>
        this.listing(listing, true, priceGuide),
      ),
      history: history.map((listing) => this.history(listing, characterId)),
    };
  }

  private listing(
    listing: ListingWithItem,
    own: boolean,
    priceGuide: Map<string, number[]> = new Map(),
  ): MarketListingModel {
    const item = listing.item ? marketItem(listing.item) : null;
    const resource =
      listing.resourceType && listing.resourceAmount
        ? resourceBalance(listing.resourceType, listing.resourceAmount)
        : null;
    const comparablePrices = priceGuide.get(comparableKey(listing)) ?? [];
    const unitMedian = medianMarketPrice(comparablePrices);
    const referencePrice =
      unitMedian === null
        ? null
        : listing.resourceAmount
          ? unitMedian * listing.resourceAmount
          : unitMedian;
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
      referencePrice,
      comparableSales: comparablePrices.length,
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
      saleFee: listing.saleFee,
      sellerProceeds: listing.price - listing.saleFee,
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
  if (input?.minPrice && listing.price < input.minPrice) return false;
  if (input?.maxPrice && listing.price > input.maxPrice) return false;
  if (input?.minLevel && (listing.item?.itemLevel ?? 0) < input.minLevel)
    return false;
  if (input?.maxLevel && (listing.item?.itemLevel ?? 100) > input.maxLevel)
    return false;
  if (
    input?.rarity &&
    input.rarity !== 'ALL' &&
    (listing.item?.rarity ?? listing.resource?.rarity) !== input.rarity
  )
    return false;
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
    setId: definition.setId,
    setName: definition.setName,
  };
}

function comparableKey(listing: ListingWithItem): string {
  if (listing.item)
    return `ITEM:${listing.item.definitionId}:${listing.item.rarity}`;
  if (listing.resourceType) return `RESOURCE:${listing.resourceType}`;
  return `MISSING:${listing.id}`;
}

function buildPriceGuide(listings: ListingWithItem[]): Map<string, number[]> {
  const guide = new Map<string, number[]>();
  for (const listing of listings) {
    const key = comparableKey(listing);
    const normalizedPrice = listing.resourceAmount
      ? Math.max(1, Math.ceil(listing.price / listing.resourceAmount))
      : listing.price;
    const prices = guide.get(key) ?? [];
    prices.push(normalizedPrice);
    guide.set(key, prices);
  }
  return guide;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

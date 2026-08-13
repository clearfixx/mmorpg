import { ItemBinding, ItemLocation, ResourceType } from '@veilfall/database';

import type { CharactersService } from '../characters/characters.service';
import type { PrismaService } from '../database/prisma.service';
import type { MarketplaceModel } from './models/marketplace.model';
import { MarketService } from './market.service';

describe('MarketService', () => {
  const characterId = '11111111-1111-4111-8111-111111111111';
  const sellerId = '22222222-2222-4222-8222-222222222222';
  const listingId = '33333333-3333-4333-8333-333333333333';
  const itemId = '44444444-4444-4444-8444-444444444444';
  const idempotencyKey = '55555555-5555-4555-8555-555555555555';

  function serviceWith(
    transaction: Record<string, unknown>,
    clientOverrides: Record<string, unknown> = {},
  ) {
    const client = {
      marketCommand: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: (tx: unknown) => unknown) =>
        Promise.resolve(work(transaction)),
      ),
      ...clientOverrides,
    };
    const service = new MarketService(
      { client } as unknown as PrismaService,
      {
        requireIdForUser: jest.fn().mockResolvedValue(characterId),
      } as unknown as CharactersService,
    );
    const testable = service as unknown as {
      read: (characterId: string) => Promise<MarketplaceModel>;
    };
    jest.spyOn(testable, 'read').mockResolvedValue({
      balance: 0,
      listingDeposit: 1,
      saleFeePercent: 5,
      page: 1,
      totalPages: 1,
      totalListings: 0,
      stats: { purchases: 0, sales: 0, spent: 0, earned: 0, feesPaid: 0 },
      listings: [],
      myListings: [],
      history: [],
    });
    return { service, client };
  }

  it('reserves an item and burns one Veil Echo when listing it', async () => {
    const tx = {
      characterResource: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      itemInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: itemId,
          itemLevel: 12,
          rarity: 'COMMON',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      marketListing: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: listingId }),
      },
      resourceLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
      marketCommand: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = serviceWith(tx);

    await service.createListing('user', {
      itemId,
      price: 17,
      idempotencyKey,
    });

    expect(tx.characterResource.updateMany).toHaveBeenCalledWith({
      where: {
        characterId,
        type: ResourceType.VEIL_ECHO,
        balance: { gte: 1 },
      },
      data: { balance: { decrement: 1 } },
    });
    expect(tx.itemInstance.updateMany).toHaveBeenCalledWith({
      where: {
        id: itemId,
        ownerId: characterId,
        location: { in: [ItemLocation.CHEST, ItemLocation.BACKPACK] },
        binding: { not: ItemBinding.BOUND },
      },
      data: { location: ItemLocation.MARKET },
    });
  });

  it('quotes an owned item from completed comparable sales', async () => {
    const item = {
      id: itemId,
      ownerId: characterId,
      definitionId: 'weapon-veteran-blade-01',
      itemLevel: 12,
      rarity: 'COMMON',
    };
    const { service } = serviceWith(
      {},
      {
        itemInstance: { findFirst: jest.fn().mockResolvedValue(item) },
        marketListing: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'sale-1', item, resourceAmount: null, price: 20 },
            { id: 'sale-2', item, resourceAmount: null, price: 30 },
          ]),
        },
      },
    );

    await expect(service.quote('user', { itemId })).resolves.toMatchObject({
      minimumPrice: 2,
      referencePrice: 25,
      comparableSales: 2,
      saleFeeAtReference: 2,
      proceedsAtReference: 23,
    });
  });

  it('reserves a resource lot separately from its listing deposit', async () => {
    const tx = {
      characterResource: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      marketListing: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: listingId }),
      },
      resourceLedgerEntry: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      marketCommand: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = serviceWith(tx);

    await service.createResourceListing('user', {
      resourceType: ResourceType.IRON,
      amount: 10,
      price: 5,
      idempotencyKey,
    });

    expect(tx.characterResource.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        characterId,
        type: ResourceType.VEIL_ECHO,
        balance: { gte: 1 },
      },
      data: { balance: { decrement: 1 } },
    });
    expect(tx.characterResource.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        characterId,
        type: ResourceType.IRON,
        balance: { gte: 10 },
      },
      data: { balance: { decrement: 10 } },
    });
  });

  it('atomically transfers currency, returned deposit, and purchased item', async () => {
    const tx = {
      marketListing: {
        findFirst: jest.fn().mockResolvedValue({
          id: listingId,
          itemId,
          sellerCharacterId: sellerId,
          price: 9,
          deposit: 1,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      characterResource: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      itemInstance: { update: jest.fn().mockResolvedValue({}) },
      resourceLedgerEntry: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      marketCommand: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = serviceWith(tx);

    await service.buyListing('user', { listingId, idempotencyKey });

    expect(tx.marketListing.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.marketListing.updateMany).toHaveBeenCalledWith({
      where: { id: listingId, status: 'ACTIVE' },
      data: {
        status: 'SOLD',
        buyerCharacterId: characterId,
        saleFee: 1,
        completedAt: expect.any(Date) as Date,
      },
    });
    expect(tx.characterResource.updateMany).toHaveBeenCalledWith({
      where: {
        characterId,
        type: ResourceType.VEIL_ECHO,
        balance: { gte: 9 },
      },
      data: { balance: { decrement: 9 } },
    });
    expect(tx.characterResource.upsert).toHaveBeenCalledWith({
      where: {
        characterId_type: {
          characterId: sellerId,
          type: ResourceType.VEIL_ECHO,
        },
      },
      create: {
        characterId: sellerId,
        type: ResourceType.VEIL_ECHO,
        balance: 9,
      },
      update: { balance: { increment: 9 } },
    });
    expect(tx.itemInstance.update).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { ownerId: characterId, location: ItemLocation.CHEST },
    });
    expect(tx.resourceLedgerEntry.createMany).toHaveBeenCalledTimes(1);
    expect(tx.resourceLedgerEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          characterId,
          type: ResourceType.VEIL_ECHO,
          amount: -9,
          reason: 'MARKET_PURCHASE',
          referenceId: listingId,
        },
        {
          characterId: sellerId,
          type: ResourceType.VEIL_ECHO,
          amount: 10,
          reason: 'MARKET_SALE',
          referenceId: listingId,
        },
        {
          characterId: sellerId,
          type: ResourceType.VEIL_ECHO,
          amount: -1,
          reason: 'MARKET_SALE_FEE',
          referenceId: listingId,
        },
      ],
    });
  });
});

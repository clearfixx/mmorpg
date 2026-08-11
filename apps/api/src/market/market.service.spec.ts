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

  function serviceWith(transaction: Record<string, unknown>) {
    const client = {
      marketCommand: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: (tx: unknown) => unknown) =>
        Promise.resolve(work(transaction)),
      ),
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
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
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
        balance: 10,
      },
      update: { balance: { increment: 10 } },
    });
    expect(tx.itemInstance.update).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { ownerId: characterId, location: ItemLocation.CHEST },
    });
  });
});

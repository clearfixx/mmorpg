import {
  ItemBinding,
  ItemLineageType,
  ItemLocation,
  ResourceType,
  TemperingJobStatus,
} from '@veilfall/database';
import {
  aggregateTemperingCost,
  cancelTemperingProcess,
  completeTemperingProcess,
  quoteTempering,
  startTemperingProcess,
  temperingPreview,
  temperingProcessView,
  type ItemRarity,
  type ResourceType as EngineResourceType,
  type TemperingProcess,
  type TemperingStoneGrade,
  type TemperingWallet,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { itemDefinition } from '../inventory/item-catalog';
import { ResolveTemperingInput } from './dto/resolve-tempering.input';
import { StartTemperingInput } from './dto/start-tempering.input';
import {
  TemperingPreviewModel,
  TemperingStateModel,
} from './models/tempering.model';

const QUEUE_CAPACITY = 3;
const STONE_RESOURCES: Record<TemperingStoneGrade, ResourceType> = {
  DULL: ResourceType.TEMPERING_STONE_DULL,
  WHOLE: ResourceType.TEMPERING_STONE_WHOLE,
  FLAWLESS: ResourceType.TEMPERING_STONE_FLAWLESS,
  MYTHIC: ResourceType.TEMPERING_STONE_MYTHIC,
  DIVINE: ResourceType.TEMPERING_STONE_DIVINE,
};

@Injectable()
export class TemperingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(
    userId: string,
    itemId: string | null,
    accelerationPercent = 0,
  ): Promise<TemperingStateModel> {
    return this.read(
      await this.characters.requireIdForUser(userId),
      itemId,
      accelerationPercent,
    );
  }

  async start(
    userId: string,
    input: StartTemperingInput,
  ): Promise<TemperingStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(
      `START:${input.itemId}:${input.accelerationPercent}:${input.expectedCharacterVersion}:${input.expectedItemVersion}`,
    );
    if (await this.replay(characterId, input.idempotencyKey, payloadHash))
      return this.read(characterId, input.itemId, input.accelerationPercent);

    await this.prisma.client.$transaction(async (tx) => {
      const [character, item, activeCount] = await Promise.all([
        tx.character.findUniqueOrThrow({ where: { id: characterId } }),
        tx.itemInstance.findFirst({
          where: {
            id: input.itemId,
            ownerId: characterId,
            location: { in: [ItemLocation.CHEST, ItemLocation.EQUIPPED] },
          },
        }),
        tx.temperingJob.count({
          where: { characterId, status: TemperingJobStatus.ACTIVE },
        }),
      ]);
      if (!item) throw new BadRequestException('Item is unavailable');
      if (activeCount >= QUEUE_CAPACITY)
        throw new ConflictException('Tempering queue is full');
      if (item.temperingVersion !== input.expectedItemVersion)
        throw new ConflictException('Item state changed; refresh and retry');

      const preview = await this.previewFor(
        tx,
        character,
        item,
        input.accelerationPercent,
      );
      if (!preview.eligible)
        throw new BadRequestException(preview.blockingReasons.join('; '));
      if (!preview.affordable)
        throw new ConflictException('Not enough tempering resources');
      const quote = quoteTempering({
        currentStage: item.temperingStage,
        accelerationPercent: input.accelerationPercent,
      });
      const cost = aggregateTemperingCost(quote);
      const version = await tx.character.updateMany({
        where: {
          id: characterId,
          version: input.expectedCharacterVersion,
          gold: { gte: cost.gold },
        },
        data: { version: { increment: 1 }, gold: { decrement: cost.gold } },
      });
      if (version.count !== 1)
        throw new ConflictException(
          'Character state changed; refresh and retry',
        );
      const locked = await tx.itemInstance.updateMany({
        where: {
          id: item.id,
          ownerId: characterId,
          temperingVersion: input.expectedItemVersion,
        },
        data: { temperingVersion: { increment: 1 } },
      });
      if (locked.count !== 1) throw new ConflictException('Item state changed');

      const resourceCosts = [
        { type: STONE_RESOURCES[cost.stoneGrade], amount: cost.stoneAmount },
        ...cost.resources.map((resource) => ({
          type: resource.resourceType,
          amount: resource.amount,
        })),
      ];
      for (const resource of resourceCosts) {
        const debited = await tx.characterResource.updateMany({
          where: {
            characterId,
            type: resource.type,
            balance: { gte: resource.amount },
          },
          data: { balance: { decrement: resource.amount } },
        });
        if (debited.count !== 1)
          throw new ConflictException('Tempering resources changed');
      }
      const startedAt = new Date();
      const readyAt = new Date(
        startedAt.getTime() + quote.durationSeconds * 1000,
      );
      const job = await tx.temperingJob.create({
        data: {
          characterId,
          itemId: item.id,
          activeItemId: item.id,
          startingStage: item.temperingStage,
          targetStage: quote.targetStage,
          startingProgress: item.temperingProgress,
          accelerationPercent: quote.accelerationPercent,
          costSnapshot: {
            gold: cost.gold,
            stoneGrade: cost.stoneGrade,
            stoneAmount: cost.stoneAmount,
            resources: cost.resources.map((resource) => ({ ...resource })),
          },
          startedAt,
          readyAt,
        },
      });
      for (const resource of resourceCosts) {
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type: resource.type,
            amount: -resource.amount,
            reason: 'TEMPERING_START',
            referenceId: job.id,
          },
        });
      }
      await tx.temperingCommand.create({
        data: {
          characterId,
          temperingJobId: job.id,
          idempotencyKey: input.idempotencyKey,
          commandType: 'START',
          payloadHash,
        },
      });
    });
    return this.read(characterId, input.itemId, input.accelerationPercent);
  }

  async complete(
    userId: string,
    input: ResolveTemperingInput,
  ): Promise<TemperingStateModel> {
    return this.resolve(userId, input, 'COMPLETE');
  }

  async cancel(
    userId: string,
    input: ResolveTemperingInput,
  ): Promise<TemperingStateModel> {
    return this.resolve(userId, input, 'CANCEL');
  }

  private async resolve(
    userId: string,
    input: ResolveTemperingInput,
    action: 'COMPLETE' | 'CANCEL',
  ): Promise<TemperingStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(
      `${action}:${input.processId}:${input.expectedCharacterVersion}:${input.expectedItemVersion}`,
    );
    if (await this.replay(characterId, input.idempotencyKey, payloadHash))
      return this.read(characterId, null, 0);
    await this.prisma.client.$transaction(async (tx) => {
      const job = await tx.temperingJob.findFirst({
        where: {
          id: input.processId,
          characterId,
          status: TemperingJobStatus.ACTIVE,
        },
        include: { item: true },
      });
      if (!job) throw new BadRequestException('Tempering job is unavailable');
      if (job.item.temperingVersion !== input.expectedItemVersion)
        throw new ConflictException('Item state changed; refresh and retry');
      const process = this.engineProcess(job);
      const now = new Date();
      if (action === 'COMPLETE' && now < job.readyAt)
        throw new ConflictException('Tempering is not complete');
      if (action === 'CANCEL' && now >= job.readyAt)
        throw new ConflictException('Ready tempering must be completed');
      const resolved =
        action === 'COMPLETE'
          ? completeTemperingProcess(process, { now, roll: randomInt(10_000) })
          : cancelTemperingProcess(process, now).process;
      const character = await tx.character.updateMany({
        where: { id: characterId, version: input.expectedCharacterVersion },
        data: { version: { increment: 1 } },
      });
      if (character.count !== 1)
        throw new ConflictException(
          'Character state changed; refresh and retry',
        );
      const itemUpdate =
        action === 'COMPLETE'
          ? {
              temperingStage: resolved.resolution!.nextStage,
              temperingProgress: resolved.resolution!.nextProgressBasisPoints,
              temperingVersion: { increment: 1 },
            }
          : { temperingVersion: { increment: 1 } };
      const updated = await tx.itemInstance.updateMany({
        where: {
          id: job.itemId,
          ownerId: characterId,
          temperingVersion: input.expectedItemVersion,
        },
        data: itemUpdate,
      });
      if (updated.count !== 1)
        throw new ConflictException('Item state changed');
      if (action === 'CANCEL') {
        const settlement = cancelTemperingProcess(process, now).settlement;
        for (const refund of settlement.resourceRefunds) {
          await tx.characterResource.upsert({
            where: {
              characterId_type: {
                characterId,
                type: refund.resourceType,
              },
            },
            create: {
              characterId,
              type: refund.resourceType,
              balance: refund.amount,
            },
            update: { balance: { increment: refund.amount } },
          });
          await tx.resourceLedgerEntry.create({
            data: {
              characterId,
              type: refund.resourceType,
              amount: refund.amount,
              reason: 'TEMPERING_REFUND',
              referenceId: job.id,
            },
          });
        }
      }
      await tx.temperingJob.update({
        where: { id: job.id },
        data: {
          activeItemId: null,
          status:
            action === 'CANCEL'
              ? TemperingJobStatus.CANCELLED
              : resolved.resolution!.outcome === 'SUCCESS'
                ? TemperingJobStatus.SUCCEEDED
                : TemperingJobStatus.PROGRESS_GAINED,
          resultProgress: resolved.resolution?.nextProgressBasisPoints,
          guaranteed: resolved.resolution?.guaranteed,
          resolvedAt: now,
        },
      });
      await tx.itemLineageEvent.create({
        data: {
          itemId: job.itemId,
          type: ItemLineageType.TEMPERING,
          payload: {
            action,
            processId: job.id,
            targetStage: job.targetStage,
            outcome: resolved.resolution?.outcome ?? 'CANCELLED',
          },
        },
      });
      await tx.temperingCommand.create({
        data: {
          characterId,
          temperingJobId: job.id,
          idempotencyKey: input.idempotencyKey,
          commandType: action,
          payloadHash,
        },
      });
    });
    return this.read(characterId, null, 0);
  }

  private async read(
    characterId: string,
    itemId: string | null,
    accelerationPercent: number,
  ): Promise<TemperingStateModel> {
    const [character, jobs, item] = await Promise.all([
      this.prisma.client.character.findUniqueOrThrow({
        where: { id: characterId },
      }),
      this.prisma.client.temperingJob.findMany({
        where: { characterId, status: TemperingJobStatus.ACTIVE },
        include: { item: true },
        orderBy: { readyAt: 'asc' },
      }),
      itemId
        ? this.prisma.client.itemInstance.findFirst({
            where: { id: itemId, ownerId: characterId },
          })
        : null,
    ]);
    const now = new Date();
    return {
      characterVersion: character.version,
      queueCapacity: QUEUE_CAPACITY,
      queueAvailable: Math.max(0, QUEUE_CAPACITY - jobs.length),
      jobs: jobs.map((job) => ({
        ...temperingProcessView(this.engineProcess(job), now),
        itemVersion: job.item.temperingVersion,
      })),
      preview: item
        ? await this.previewFor(
            this.prisma.client,
            character,
            item,
            accelerationPercent,
          )
        : null,
    };
  }

  private async previewFor(
    tx: Pick<typeof this.prisma.client, 'characterResource'>,
    character: { level: number; gold: number },
    item: {
      id: string;
      definitionId: string;
      itemLevel: number;
      rarity: string;
      binding: ItemBinding;
      damage: number;
      armor: number;
      health: number;
      temperingStage: number;
      temperingProgress: number;
      temperingVersion: number;
      ownerId: string;
    },
    accelerationPercent: number,
  ): Promise<TemperingPreviewModel> {
    const balances = await tx.characterResource.findMany({
      where: { characterId: item.ownerId },
    });
    const balanceMap = new Map(
      balances.map((entry) => [entry.type, entry.balance]),
    );
    const wallet = this.wallet(character.gold, balanceMap);
    const preview = temperingPreview({
      heroLevel: character.level,
      itemLevel: item.itemLevel,
      rarity: item.rarity as ItemRarity,
      binding: item.binding,
      currentStage: item.temperingStage,
      progressBasisPoints: item.temperingProgress,
      baseStats: {
        damage: item.damage,
        armor: item.armor,
        health: item.health,
      },
      wallet,
      accelerationPercent,
    });
    const cost = preview.totalCost;
    const costs = cost
      ? [
          { key: 'GOLD', required: cost.gold, available: wallet.gold },
          {
            key: `${cost.stoneGrade}_STONE`,
            required: cost.stoneAmount,
            available: wallet.stones[cost.stoneGrade] ?? 0,
          },
          ...cost.resources.map((resource) => ({
            key: resource.resourceType,
            required: resource.amount,
            available: wallet.resources[resource.resourceType] ?? 0,
          })),
        ].map((entry) => ({
          ...entry,
          sufficient: entry.available >= entry.required,
        }))
      : [];
    return {
      itemId: item.id,
      itemName: itemDefinition(item.definitionId)?.name ?? item.definitionId,
      itemVersion: item.temperingVersion,
      currentStage: preview.currentStage,
      targetStage: preview.targetStage,
      progressBasisPoints: preview.progressBasisPoints,
      successChanceBasisPoints: preview.successChanceBasisPoints,
      guaranteed: preview.guaranteed,
      eligible: preview.eligible,
      affordable: preview.affordable,
      durationSeconds: preview.quote?.durationSeconds ?? 0,
      accelerationPercent: preview.quote?.accelerationPercent ?? 0,
      blockingReasons: [...preview.blockingReasons],
      warnings: [...preview.warnings],
      costs,
      stats: {
        currentDamage: preview.stats.current.damage,
        nextDamage: preview.stats.onSuccess.damage,
        damageDelta: preview.stats.delta.damage,
        currentArmor: preview.stats.current.armor,
        nextArmor: preview.stats.onSuccess.armor,
        armorDelta: preview.stats.delta.armor,
        currentHealth: preview.stats.current.health,
        nextHealth: preview.stats.onSuccess.health,
        healthDelta: preview.stats.delta.health,
      },
    };
  }

  private engineProcess(job: {
    id: string;
    itemId: string;
    startingStage: number;
    startingProgress: number;
    accelerationPercent: number;
    startedAt: Date;
    readyAt: Date;
  }): TemperingProcess {
    const process = startTemperingProcess({
      id: job.id,
      itemId: job.itemId,
      currentStage: job.startingStage,
      progressBasisPoints: job.startingProgress,
      accelerationPercent: job.accelerationPercent,
      startedAt: job.startedAt,
    });
    return { ...process, readyAt: new Date(job.readyAt) };
  }

  private wallet(
    gold: number,
    balances: Map<ResourceType, number>,
  ): TemperingWallet {
    const resources: Partial<Record<EngineResourceType, number>> = {};
    for (const [type, balance] of balances)
      if (!Object.values(STONE_RESOURCES).includes(type))
        resources[type] = balance;
    const stones: Partial<Record<TemperingStoneGrade, number>> = {};
    for (const [grade, type] of Object.entries(STONE_RESOURCES))
      stones[grade as TemperingStoneGrade] = balances.get(type) ?? 0;
    return { gold, stones, resources };
  }

  private async replay(
    characterId: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<boolean> {
    const existing = await this.prisma.client.temperingCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
    if (!existing) return false;
    if (existing.payloadHash !== payloadHash)
      throw new ConflictException('Command key was reused');
    return true;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

import {
  BattleStatus,
  ItemLineageType,
  ItemLocation,
  Prisma,
  TalentType,
} from '@veilfall/database';
import {
  actionsFor,
  createBattle,
  INTENTS,
  resolveTurn,
  sumEquipmentStats,
  talentBonuses,
  type ActionId,
  type BattleState,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { WorldService } from '../world/world.service';
import { SubmitCombatCommandInput } from './dto/submit-combat-command.input';
import { ContinueAdventureInput } from './dto/continue-adventure.input';
import { HireExpeditionGuideInput } from './dto/hire-expedition-guide.input';
import { BattleModel } from './models/battle.model';
import { ExpeditionProgressModel } from './models/expedition-progress.model';

export function expeditionCheckpointCost(tier: number): number {
  const safeTier = Math.max(2, Math.floor(tier));
  return safeTier * safeTier * 25;
}

@Injectable()
export class CombatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
    private readonly world: WorldService,
  ) {}

  async activeForUser(userId: string): Promise<BattleModel | null> {
    const characterId = await this.characters.requireIdForUser(userId);
    const battle = await this.prisma.client.battle.findFirst({
      where: { characterId, status: BattleStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    if (!battle) return null;
    if (
      battle.pendingState &&
      battle.enemyReadyAt &&
      battle.enemyReadyAt <= new Date()
    )
      return this.finishEnemyResponse(battle.id, characterId);
    return this.toModel(
      battle.id,
      battle.state as unknown as BattleState,
      battle.pendingState ? 'ENEMY_RESOLVING' : 'PLAYER_TURN',
    );
  }

  async latestForUser(userId: string): Promise<BattleModel | null> {
    const characterId = await this.characters.requireIdForUser(userId);
    const battle = await this.prisma.client.battle.findFirst({
      where: { characterId, resultAcknowledgedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!battle) return null;
    if (
      battle.status === BattleStatus.ACTIVE &&
      battle.pendingState &&
      battle.enemyReadyAt &&
      battle.enemyReadyAt <= new Date()
    )
      return this.finishEnemyResponse(battle.id, characterId);
    return this.toModel(
      battle.id,
      battle.state as unknown as BattleState,
      battle.pendingState ? 'ENEMY_RESOLVING' : undefined,
    );
  }

  async expeditionProgress(userId: string): Promise<ExpeditionProgressModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      select: { gold: true, worldState: true },
    });
    const highestClearedTier = character.worldState?.highestClearedTier ?? 0;
    const checkpointTier = character.worldState?.guideCheckpointTier ?? 1;
    const saveableTier =
      highestClearedTier > checkpointTier ? highestClearedTier : null;
    const saveCost =
      saveableTier === null ? null : expeditionCheckpointCost(saveableTier);
    return {
      highestClearedTier,
      checkpointTier,
      saveableTier,
      saveCost,
      gold: character.gold,
      canAffordSave: saveCost !== null && character.gold >= saveCost,
    };
  }

  async hireGuide(
    userId: string,
    input: HireExpeditionGuideInput,
  ): Promise<ExpeditionProgressModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(`GUIDE:${input.checkpointTier}`)
      .digest('hex');
    const existing = await this.prisma.client.expeditionGuideCommand.findUnique(
      {
        where: {
          characterId_idempotencyKey: {
            characterId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      },
    );
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Command key was used for another tier');
      return this.expeditionProgress(userId);
    }
    const cost = expeditionCheckpointCost(input.checkpointTier);
    await this.prisma.client.$transaction(async (tx) => {
      const state = await tx.characterWorldState.findUniqueOrThrow({
        where: { characterId },
      });
      if (input.checkpointTier !== state.highestClearedTier)
        throw new BadRequestException(
          'Only the highest cleared tier can be secured',
        );
      if (input.checkpointTier <= state.guideCheckpointTier)
        throw new BadRequestException('Checkpoint is already secured');
      const latestVictory = await tx.battle.findFirst({
        where: {
          characterId,
          status: BattleStatus.WON,
          resultAcknowledgedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { state: true },
      });
      const clearedTier = (
        latestVictory?.state as
          { encounterTier?: number; personalBest?: boolean } | undefined
      )?.encounterTier;
      const personalBest = (
        latestVictory?.state as { personalBest?: boolean } | undefined
      )?.personalBest;
      if (clearedTier !== input.checkpointTier || personalBest !== true)
        throw new BadRequestException(
          'A new personal-best victory is required to secure the route',
        );
      const secured = await tx.characterWorldState.updateMany({
        where: {
          characterId,
          highestClearedTier: input.checkpointTier,
          guideCheckpointTier: { lt: input.checkpointTier },
        },
        data: {
          guideCheckpointTier: input.checkpointTier,
          version: { increment: 1 },
        },
      });
      if (secured.count !== 1)
        throw new ConflictException('Checkpoint state changed; refresh');
      const paid = await tx.character.updateMany({
        where: { id: characterId, gold: { gte: cost } },
        data: { gold: { decrement: cost }, version: { increment: 1 } },
      });
      if (paid.count !== 1)
        throw new BadRequestException('Not enough gold for the guide');
      await tx.expeditionGuideCommand.create({
        data: {
          characterId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          checkpointTier: input.checkpointTier,
          goldCost: cost,
        },
      });
    });
    return this.expeditionProgress(userId);
  }

  async start(userId: string): Promise<BattleModel> {
    const context = await this.world.encounterContext(userId);
    const active = await this.prisma.client.battle.findFirst({
      where: { characterId: context.characterId, status: BattleStatus.ACTIVE },
    });
    if (active)
      return this.toModel(
        active.id,
        active.state as unknown as BattleState,
        active.pendingState ? 'ENEMY_RESOLVING' : 'PLAYER_TURN',
      );

    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: context.characterId },
      select: {
        archetype: true,
        level: true,
        talents: { select: { type: true, rank: true } },
        equipment: {
          select: {
            item: { select: { damage: true, armor: true, health: true } },
          },
        },
      },
    });
    const equipment = sumEquipmentStats(
      character.equipment.map((assignment) => assignment.item),
    );
    const bonuses = this.combatTalentBonuses(character.talents, equipment);
    const state = createBattle(
      character.archetype,
      context.preparation,
      equipment.damage,
      context.checkpointTier,
      character.level,
      bonuses,
    );
    const battle = await this.prisma.client.battle.create({
      data: {
        characterId: context.characterId,
        activeCharacterId: context.characterId,
        encounterId: `hollow-road-tier-${context.checkpointTier}`,
        seed: 1701 + context.checkpointTier,
        state: state as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toModel(battle.id, state);
  }

  async submit(
    userId: string,
    input: SubmitCombatCommandInput,
  ): Promise<BattleModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const battle = await this.prisma.client.battle.findFirst({
      where: { characterId, status: BattleStatus.ACTIVE },
    });
    if (!battle) throw new BadRequestException('No active battle');
    const existing = await this.prisma.client.battleCommand.findUnique({
      where: {
        battleId_idempotencyKey: {
          battleId: battle.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.actionId !== input.actionId)
        throw new ConflictException('Command key already used');
      const current = await this.prisma.client.battle.findUniqueOrThrow({
        where: { id: battle.id },
      });
      return this.toModel(
        current.id,
        current.state as unknown as BattleState,
        current.pendingState ? 'ENEMY_RESOLVING' : undefined,
      );
    }
    if (battle.pendingState)
      throw new ConflictException('Enemy response is still resolving');
    if (battle.version !== input.expectedVersion)
      throw new ConflictException('Battle state changed; refresh and retry');

    let next: BattleState;
    try {
      next = resolveTurn(
        battle.state as unknown as BattleState,
        input.actionId as ActionId,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid action',
      );
    }
    const status = next.status;
    if (status === BattleStatus.ACTIVE) {
      await this.prisma.client.$transaction(async (tx) => {
        const result = await tx.battle.updateMany({
          where: {
            id: battle.id,
            version: input.expectedVersion,
            status: BattleStatus.ACTIVE,
            enemyReadyAt: null,
          },
          data: {
            pendingState: next as unknown as Prisma.InputJsonValue,
            enemyReadyAt: new Date(Date.now() + 1200),
          },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'Battle state changed; refresh and retry',
          );
        await tx.battleCommand.create({
          data: {
            battleId: battle.id,
            idempotencyKey: input.idempotencyKey,
            expectedVersion: input.expectedVersion,
            actionId: input.actionId,
            resultingVersion: next.version,
          },
        });
      });
      return this.toModel(
        battle.id,
        battle.state as unknown as BattleState,
        'ENEMY_RESOLVING',
      );
    }
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.battle.updateMany({
        where: {
          id: battle.id,
          version: input.expectedVersion,
          status: BattleStatus.ACTIVE,
        },
        data: {
          state: next as unknown as Prisma.InputJsonValue,
          version: next.version,
          status,
          completedAt: new Date(),
          activeCharacterId: null,
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Battle state changed; refresh and retry');
      await tx.battleCommand.create({
        data: {
          battleId: battle.id,
          idempotencyKey: input.idempotencyKey,
          expectedVersion: input.expectedVersion,
          actionId: input.actionId,
          resultingVersion: next.version,
        },
      });
      if (status === BattleStatus.LOST) {
        await this.loseBackpack(tx, characterId, battle.id);
        await tx.characterWorldState.update({
          where: { characterId },
          data: {
            currentLocation: 'BROKEN_WATCHPOST',
            preparationChoice: null,
            version: { increment: 1 },
          },
        });
      }
      if (status === BattleStatus.WON) {
        const clearedTier = next.encounterTier ?? 1;
        const record = await tx.characterWorldState.updateMany({
          where: { characterId, highestClearedTier: { lt: clearedTier } },
          data: { highestClearedTier: clearedTier },
        });
        next.personalBest = record.count === 1;
        await tx.battle.update({
          where: { id: battle.id },
          data: { state: next as unknown as Prisma.InputJsonValue },
        });
      }
      return tx.battle.findUniqueOrThrow({ where: { id: battle.id } });
    });
    return this.toModel(updated.id, updated.state as unknown as BattleState);
  }

  async continueAdventure(
    userId: string,
    input: ContinueAdventureInput,
  ): Promise<BattleModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const previous = await this.prisma.client.battle.findFirst({
      where: {
        id: input.battleId,
        characterId,
        status: BattleStatus.WON,
        resultAcknowledgedAt: null,
        rewardClaim: { isNot: null },
      },
    });
    if (!previous)
      throw new BadRequestException('Claimed victory is required to continue');
    const existing = await this.prisma.client.battleCommand.findUnique({
      where: {
        battleId_idempotencyKey: {
          battleId: previous.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.actionId !== 'CONTINUE_ADVENTURE')
        throw new ConflictException('Command key already used');
      const active = await this.prisma.client.battle.findFirstOrThrow({
        where: { characterId, status: BattleStatus.ACTIVE },
      });
      return this.toModel(active.id, active.state as unknown as BattleState);
    }
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      select: {
        archetype: true,
        level: true,
        talents: { select: { type: true, rank: true } },
        equipment: {
          select: {
            item: { select: { damage: true, armor: true, health: true } },
          },
        },
      },
    });
    const equipment = sumEquipmentStats(
      character.equipment.map((assignment) => assignment.item),
    );
    const bonuses = this.combatTalentBonuses(character.talents, equipment);
    const previousState = previous.state as unknown as BattleState;
    const tier = (previousState.encounterTier ?? 1) + 1;
    const next = createBattle(
      character.archetype,
      previousState.preparation,
      equipment.damage,
      tier,
      character.level,
      bonuses,
    );
    const battle = await this.prisma.client.$transaction(async (tx) => {
      const acknowledged = await tx.battle.updateMany({
        where: { id: previous.id, resultAcknowledgedAt: null },
        data: { resultAcknowledgedAt: new Date() },
      });
      if (acknowledged.count !== 1)
        throw new ConflictException('Adventure state changed');
      await tx.battleCommand.create({
        data: {
          battleId: previous.id,
          idempotencyKey: input.idempotencyKey,
          expectedVersion: previous.version,
          actionId: 'CONTINUE_ADVENTURE',
          resultingVersion: previous.version,
        },
      });
      return tx.battle.create({
        data: {
          characterId,
          activeCharacterId: characterId,
          encounterId: `hollow-road-tier-${tier}`,
          seed: 1701 + tier,
          state: next as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return this.toModel(battle.id, next);
  }

  async retreat(userId: string, expectedVersion: number): Promise<BattleModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const battle = await this.prisma.client.battle.findFirst({
      where: { characterId, status: BattleStatus.ACTIVE },
    });
    if (
      !battle ||
      battle.pendingState ||
      battle.version !== expectedVersion ||
      expectedVersion < 2
    )
      throw new ConflictException('Battle cannot be retreated from');
    const state = battle.state as unknown as BattleState;
    state.status = 'RETREATED';
    state.version += 1;
    state.log = [
      ...state.log,
      {
        turn: state.turn,
        kind: 'SYSTEM',
        message: 'Герой відступає до Зламаної застави.',
      },
    ];
    await this.prisma.client.$transaction(async (tx) => {
      await tx.battle.update({
        where: { id: battle.id },
        data: {
          state: state as unknown as Prisma.InputJsonValue,
          version: state.version,
          status: BattleStatus.RETREATED,
          completedAt: new Date(),
          activeCharacterId: null,
        },
      });
      await this.storeBackpack(tx, characterId);
      await tx.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: null,
          version: { increment: 1 },
        },
      });
    });
    return this.toModel(battle.id, state);
  }

  async returnToWatchpost(userId: string): Promise<boolean> {
    const characterId = await this.characters.requireIdForUser(userId);
    const active = await this.prisma.client.battle.count({
      where: { characterId, status: BattleStatus.ACTIVE },
    });
    if (active > 0)
      throw new ConflictException('Finish or retreat from battle first');
    const latestResult = await this.prisma.client.battle.findFirst({
      where: {
        characterId,
        resultAcknowledgedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { status: true, rewardClaim: { select: { id: true } } },
    });
    if (
      latestResult?.status === BattleStatus.WON &&
      latestResult.rewardClaim === null
    )
      throw new ConflictException('Claim the battle reward before returning');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.battle.updateMany({
        where: {
          characterId,
          status: { not: BattleStatus.ACTIVE },
          resultAcknowledgedAt: null,
        },
        data: { resultAcknowledgedAt: new Date() },
      });
      await this.storeBackpack(tx, characterId);
      await tx.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: null,
          version: { increment: 1 },
        },
      });
    });
    return true;
  }

  private async finishEnemyResponse(
    battleId: string,
    characterId: string,
  ): Promise<BattleModel> {
    const battle = await this.prisma.client.battle.findUniqueOrThrow({
      where: { id: battleId },
    });
    if (!battle.pendingState)
      return this.toModel(battle.id, battle.state as unknown as BattleState);
    const next = battle.pendingState as unknown as BattleState;
    const status = next.status;
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.battle.updateMany({
        where: {
          id: battleId,
          version: battle.version,
          enemyReadyAt: battle.enemyReadyAt,
        },
        data: {
          state: next as unknown as Prisma.InputJsonValue,
          pendingState: Prisma.DbNull,
          enemyReadyAt: null,
          version: next.version,
          status,
          completedAt: status === BattleStatus.ACTIVE ? null : new Date(),
          activeCharacterId:
            status === BattleStatus.ACTIVE ? characterId : null,
        },
      });
      if (result.count === 1 && status === BattleStatus.LOST) {
        await this.loseBackpack(tx, characterId, battleId);
        await tx.characterWorldState.update({
          where: { characterId },
          data: {
            currentLocation: 'BROKEN_WATCHPOST',
            preparationChoice: null,
            version: { increment: 1 },
          },
        });
      }
      if (result.count === 1 && status === BattleStatus.WON) {
        const clearedTier = next.encounterTier ?? 1;
        const record = await tx.characterWorldState.updateMany({
          where: { characterId, highestClearedTier: { lt: clearedTier } },
          data: { highestClearedTier: clearedTier },
        });
        next.personalBest = record.count === 1;
        await tx.battle.update({
          where: { id: battleId },
          data: { state: next as unknown as Prisma.InputJsonValue },
        });
      }
      return result.count === 1;
    });
    if (!updated) {
      const current = await this.prisma.client.battle.findUniqueOrThrow({
        where: { id: battleId },
      });
      return this.toModel(
        current.id,
        current.state as unknown as BattleState,
        current.pendingState ? 'ENEMY_RESOLVING' : undefined,
      );
    }
    return this.toModel(
      battle.id,
      next,
      status === BattleStatus.ACTIVE ? 'PLAYER_TURN' : 'COMPLETED',
    );
  }

  private async storeBackpack(
    tx: Prisma.TransactionClient,
    characterId: string,
  ): Promise<void> {
    const items = await tx.itemInstance.findMany({
      where: { ownerId: characterId, location: ItemLocation.BACKPACK },
      select: { id: true },
    });
    if (items.length === 0) return;
    const itemIds = items.map(({ id }) => id);
    await tx.itemInstance.updateMany({
      where: {
        id: { in: itemIds },
        ownerId: characterId,
        location: ItemLocation.BACKPACK,
      },
      data: { location: ItemLocation.CHEST },
    });
    await tx.itemLineageEvent.createMany({
      data: itemIds.map((itemId) => ({
        itemId,
        type: ItemLineageType.STORED_IN_CHEST,
        payload: { reason: 'RETURNED_TO_WATCHPOST' },
      })),
    });
  }

  private async loseBackpack(
    tx: Prisma.TransactionClient,
    characterId: string,
    battleId: string,
  ): Promise<void> {
    const items = await tx.itemInstance.findMany({
      where: { ownerId: characterId, location: ItemLocation.BACKPACK },
      select: { id: true },
    });
    if (items.length === 0) return;
    const itemIds = items.map(({ id }) => id);
    await tx.itemInstance.updateMany({
      where: {
        id: { in: itemIds },
        ownerId: characterId,
        location: ItemLocation.BACKPACK,
      },
      data: { location: ItemLocation.LOST },
    });
    await tx.itemLineageEvent.createMany({
      data: itemIds.map((itemId) => ({
        itemId,
        type: ItemLineageType.LOST_IN_BATTLE,
        payload: { battleId },
      })),
    });
  }

  private toModel(
    id: string,
    state: BattleState,
    phase = state.status === 'ACTIVE' ? 'PLAYER_TURN' : 'COMPLETED',
  ): BattleModel {
    const intent = INTENTS[state.intentIndex] ?? INTENTS[0];
    const visibleCount = state.preparation === 'INSPECT_TRACKS' ? 2 : 1;
    return {
      id,
      status: state.status,
      phase,
      encounterTier: state.encounterTier ?? 1,
      personalBest: state.personalBest ?? false,
      enemyName:
        state.enemyLabel ??
        ((state.encounterTier ?? 1) > 1
          ? 'Загартований Завісою розоритель'
          : 'Спотворений Завісою мародер'),
      version: state.version,
      turn: state.turn,
      hero: state.hero,
      enemy: state.enemy,
      currentIntent: intent,
      visibleIntents: Array.from(
        { length: visibleCount },
        (_, offset) =>
          INTENTS[(state.intentIndex + offset) % INTENTS.length] ?? INTENTS[0],
      ),
      actions: actionsFor(state.archetype),
      log: state.log.map((entry) =>
        typeof entry === 'string'
          ? { turn: 0, kind: 'SYSTEM', message: entry }
          : entry,
      ),
    };
  }

  private combatTalentBonuses(
    talents: Array<{ type: TalentType; rank: number }>,
    equipment: { health: number; armor: number } = { health: 0, armor: 0 },
  ) {
    const ranks = Object.fromEntries(
      talents.map((talent) => [talent.type, talent.rank]),
    );
    const basic = talentBonuses({
      vitality: ranks[TalentType.VITALITY] ?? 0,
      power: ranks[TalentType.POWER] ?? 0,
      resilience: ranks[TalentType.RESILIENCE] ?? 0,
    });
    return {
      health:
        basic.health +
        (ranks[TalentType.AWAKENED_VITALITY] ?? 0) * 30 +
        equipment.health,
      damage: basic.damage + (ranks[TalentType.AWAKENED_POWER] ?? 0) * 8,
      armor:
        basic.armor +
        (ranks[TalentType.AWAKENED_RESILIENCE] ?? 0) * 6 +
        equipment.armor,
    };
  }
}

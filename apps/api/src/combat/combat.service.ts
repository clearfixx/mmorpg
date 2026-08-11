import {
  BattleStatus,
  ItemLineageType,
  ItemLocation,
  Prisma,
  ResourceType,
  TalentType,
} from '@veilfall/database';
import {
  actionsFor,
  createBattle,
  createDryadForestBattle,
  INTENTS,
  resolveTurn,
  sumEquipmentStats,
  talentBonuses,
  type ActionId,
  type BattleState,
  type CombatLoadout,
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
import { InvokeBossInput } from './dto/invoke-boss.input';
import { BattleModel } from './models/battle.model';
import { ExpeditionProgressModel } from './models/expedition-progress.model';

export function expeditionCheckpointCost(tier: number): number {
  const safeTier = Math.max(2, Math.floor(tier));
  return safeTier * safeTier * 25;
}

export function rareEncounterWeek(now: Date): string {
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

export function shouldSpawnRareEncounter(input: {
  level: number;
  encounters: number;
  roll: number;
  force?: boolean;
}): boolean {
  if (input.level < 30) return false;
  if (input.force) return true;
  if (input.encounters >= 5) return false;
  if (input.encounters === 0) return true;
  const chances = [10_000, 2_500, 1_200, 600, 300];
  return input.roll % 10_000 < (chances[input.encounters] ?? 0);
}

function resourceInvocationText(resource: ResourceType): string {
  if (resource === ResourceType.BOSS_INVOCATION_SEAL)
    return 'Печатка розколюється.';
  if (resource === ResourceType.DARK_PRIEST_INVOCATION_SEAL)
    return 'Перекована печатка розсипається чорним попелом.';
  if (resource === ResourceType.FALLEN_ELF_EYE)
    return 'Три ока Павшого ельфа відкривають розлом.';
  if (resource === ResourceType.DARK_PRIEST_ASH)
    return 'Три жмені ритуального попелу окреслюють розлом.';
  return 'Три прокляті серця згорають у чорному полум’ї.';
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
    const dryadForest =
      character.worldState?.currentLocation === 'DRYAD_FOREST';
    const highestClearedTier = dryadForest
      ? (character.worldState?.dryadHighestClearedTier ?? 0)
      : (character.worldState?.highestClearedTier ?? 0);
    const checkpointTier = dryadForest
      ? (character.worldState?.dryadGuideCheckpointTier ?? 1)
      : (character.worldState?.guideCheckpointTier ?? 1);
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
      const dryadForest = state.currentLocation === 'DRYAD_FOREST';
      const highestClearedTier = dryadForest
        ? state.dryadHighestClearedTier
        : state.highestClearedTier;
      const guideCheckpointTier = dryadForest
        ? state.dryadGuideCheckpointTier
        : state.guideCheckpointTier;
      if (input.checkpointTier !== highestClearedTier)
        throw new BadRequestException(
          'Only the highest cleared tier can be secured',
        );
      if (input.checkpointTier <= guideCheckpointTier)
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
        where: dryadForest
          ? {
              characterId,
              dryadHighestClearedTier: input.checkpointTier,
              dryadGuideCheckpointTier: { lt: input.checkpointTier },
            }
          : {
              characterId,
              highestClearedTier: input.checkpointTier,
              guideCheckpointTier: { lt: input.checkpointTier },
            },
        data: dryadForest
          ? {
              dryadGuideCheckpointTier: input.checkpointTier,
              version: { increment: 1 },
            }
          : {
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
            slot: true,
            item: {
              select: {
                definitionId: true,
                damage: true,
                armor: true,
                health: true,
              },
            },
          },
        },
        resources: {
          where: {
            type: {
              in: [ResourceType.HEALTH_POTION, ResourceType.MANA_POTION],
            },
          },
          select: { type: true, balance: true },
        },
      },
    });
    const equipment = sumEquipmentStats(
      character.equipment.map((assignment) => assignment.item),
    );
    const bonuses = this.combatTalentBonuses(character.talents, equipment);
    const loadout = this.combatLoadout(
      character.equipment,
      character.resources,
    );
    const rareEncounter =
      context.region === 'DRYAD_FOREST'
        ? false
        : await this.reserveRareEncounter(
            context.characterId,
            character.level,
            context.checkpointTier,
          );
    const state =
      context.region === 'DRYAD_FOREST'
        ? createDryadForestBattle(
            character.archetype,
            equipment.damage,
            context.checkpointTier,
            character.level,
            bonuses,
            loadout,
          )
        : createBattle(
            character.archetype,
            context.preparation,
            equipment.damage,
            context.checkpointTier,
            character.level,
            bonuses,
            rareEncounter,
            loadout,
          );
    const battle = await this.prisma.client.battle.create({
      data: {
        characterId: context.characterId,
        activeCharacterId: context.characterId,
        encounterId:
          context.region === 'DRYAD_FOREST'
            ? `dryad-forest-tier-${context.checkpointTier}`
            : rareEncounter
              ? 'rare-seal-warden'
              : `hollow-road-tier-${context.checkpointTier}`,
        seed: 1701 + context.checkpointTier,
        state: state as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toModel(battle.id, state);
  }

  async invokeCursedKnight(
    userId: string,
    input: InvokeBossInput,
  ): Promise<BattleModel> {
    return this.invokeBoss(userId, input, {
      id: 'CURSED_KNIGHT',
      encounterId: 'invoked-cursed-knight',
      name: 'Проклятий лицар Морґрейв',
      resource: ResourceType.BOSS_INVOCATION_SEAL,
      resourceAmount: 1,
      minimumHealth: 2_400,
      healthPerLevel: 70,
      damageBonus: 42,
      seed: 9_001,
    });
  }

  async invokeFallenElf(
    userId: string,
    input: InvokeBossInput,
  ): Promise<BattleModel> {
    return this.invokeBoss(userId, input, {
      id: 'FALLEN_ELF',
      encounterId: 'invoked-fallen-elf',
      name: 'Павший ельф Саелір',
      resource: ResourceType.CURSED_HEART,
      resourceAmount: 3,
      minimumHealth: 4_800,
      healthPerLevel: 115,
      damageBonus: 76,
      seed: 9_002,
    });
  }

  async invokeDarkPriest(
    userId: string,
    input: InvokeBossInput,
  ): Promise<BattleModel> {
    return this.invokeBoss(userId, input, {
      id: 'DARK_PRIEST',
      encounterId: 'invoked-dark-priest',
      name: 'Темний жрець Нервал',
      resource: ResourceType.DARK_PRIEST_INVOCATION_SEAL,
      resourceAmount: 1,
      minimumHealth: 3_400,
      healthPerLevel: 92,
      damageBonus: 61,
      seed: 9_003,
    });
  }

  async invokeVeilWardenFromEyes(
    userId: string,
    input: InvokeBossInput,
  ): Promise<BattleModel> {
    return this.invokeVeilWarden(
      userId,
      input,
      ResourceType.FALLEN_ELF_EYE,
      3,
      9_004,
    );
  }

  async invokeVeilWardenFromAsh(
    userId: string,
    input: InvokeBossInput,
  ): Promise<BattleModel> {
    return this.invokeVeilWarden(
      userId,
      input,
      ResourceType.DARK_PRIEST_ASH,
      3,
      9_005,
    );
  }

  private invokeVeilWarden(
    userId: string,
    input: InvokeBossInput,
    resource: ResourceType,
    resourceAmount: number,
    seed: number,
  ): Promise<BattleModel> {
    return this.invokeBoss(userId, input, {
      id: 'VEIL_WARDEN',
      encounterId: `invoked-veil-warden-${resource.toLowerCase()}`,
      name: 'Вартовий Розколотої Завіси',
      resource,
      resourceAmount,
      minimumHealth: 8_500,
      healthPerLevel: 185,
      damageBonus: 118,
      seed,
    });
  }

  private async invokeBoss(
    userId: string,
    input: InvokeBossInput,
    boss: {
      id: 'CURSED_KNIGHT' | 'FALLEN_ELF' | 'DARK_PRIEST' | 'VEIL_WARDEN';
      encounterId: string;
      name: string;
      resource: ResourceType;
      resourceAmount: number;
      minimumHealth: number;
      healthPerLevel: number;
      damageBonus: number;
      seed: number;
    },
  ): Promise<BattleModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(`INVOKE:${boss.id}:${boss.resource}:${boss.resourceAmount}`)
      .digest('hex');
    const existing = await this.prisma.client.bossInvocationCommand.findUnique({
      where: {
        characterId_idempotencyKey: {
          characterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { battle: true },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Invocation key was already used');
      return this.toModel(
        existing.battle.id,
        existing.battle.state as unknown as BattleState,
      );
    }
    const active = await this.prisma.client.battle.count({
      where: { characterId, status: BattleStatus.ACTIVE },
    });
    if (active > 0) throw new ConflictException('Finish the active battle');
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      select: {
        archetype: true,
        level: true,
        worldState: { select: { currentLocation: true } },
        talents: { select: { type: true, rank: true } },
        equipment: {
          select: {
            slot: true,
            item: {
              select: {
                definitionId: true,
                damage: true,
                armor: true,
                health: true,
              },
            },
          },
        },
        resources: {
          where: {
            type: {
              in: [ResourceType.HEALTH_POTION, ResourceType.MANA_POTION],
            },
          },
          select: { type: true, balance: true },
        },
      },
    });
    if (character.level < 30)
      throw new BadRequestException('Level 30 is required for the ritual');
    if (character.worldState?.currentLocation !== 'CINDERHAVEN_GATE')
      throw new BadRequestException('The ritual circle is in Cinderhaven');
    const equipment = sumEquipmentStats(
      character.equipment.map((assignment) => assignment.item),
    );
    const bonuses = this.combatTalentBonuses(character.talents, equipment);
    const loadout = this.combatLoadout(
      character.equipment,
      character.resources,
    );
    const state = createBattle(
      character.archetype,
      'REST_BRAZIER',
      equipment.damage,
      12,
      character.level,
      bonuses,
      false,
      loadout,
    );
    state.summonedBoss = true;
    state.summonedBossId = boss.id;
    state.returnLocation = 'CINDERHAVEN_GATE';
    state.enemyLabel = boss.name;
    state.enemy.maxHealth = Math.max(
      boss.minimumHealth,
      character.level * boss.healthPerLevel,
    );
    state.enemy.health = state.enemy.maxHealth;
    state.enemyDamageBonus += boss.damageBonus + character.level;
    state.log = [
      {
        turn: 0,
        kind: 'SYSTEM',
        message: `${resourceInvocationText(boss.resource)} ${boss.name} постає у ритуальному колі.`,
      },
    ];
    const battle = await this.prisma.client.$transaction(async (tx) => {
      const consumed = await tx.characterResource.updateMany({
        where: {
          characterId,
          type: boss.resource,
          balance: { gte: boss.resourceAmount },
        },
        data: { balance: { decrement: boss.resourceAmount } },
      });
      if (consumed.count !== 1)
        throw new BadRequestException('The ritual components are missing');
      const created = await tx.battle.create({
        data: {
          characterId,
          activeCharacterId: characterId,
          encounterId: boss.encounterId,
          seed: boss.seed,
          state: state as unknown as Prisma.InputJsonValue,
        },
      });
      const command = await tx.bossInvocationCommand.create({
        data: {
          characterId,
          battleId: created.id,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        },
      });
      await tx.resourceLedgerEntry.create({
        data: {
          characterId,
          type: boss.resource,
          amount: -boss.resourceAmount,
          reason: 'BOSS_INVOCATION',
          referenceId: command.id,
        },
      });
      await tx.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'HOLLOW_ROAD',
          preparationChoice: 'REST_BRAZIER',
          version: { increment: 1 },
        },
      });
      return created;
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
      if (
        existing.actionId !== input.actionId ||
        existing.targetEnemyId !== (input.targetEnemyId ?? null)
      )
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
        input.targetEnemyId,
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
        const command = await tx.battleCommand.create({
          data: {
            battleId: battle.id,
            idempotencyKey: input.idempotencyKey,
            expectedVersion: input.expectedVersion,
            actionId: input.actionId,
            targetEnemyId: input.targetEnemyId,
            resultingVersion: next.version,
          },
        });
        await this.consumeBattlePotion(
          tx,
          characterId,
          input.actionId,
          command.id,
        );
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
      const command = await tx.battleCommand.create({
        data: {
          battleId: battle.id,
          idempotencyKey: input.idempotencyKey,
          expectedVersion: input.expectedVersion,
          actionId: input.actionId,
          targetEnemyId: input.targetEnemyId,
          resultingVersion: next.version,
        },
      });
      await this.consumeBattlePotion(
        tx,
        characterId,
        input.actionId,
        command.id,
      );
      if (status === BattleStatus.LOST) {
        await this.loseBackpack(tx, characterId, battle.id);
        await tx.characterWorldState.update({
          where: { characterId },
          data: {
            currentLocation: next.returnLocation ?? 'BROKEN_WATCHPOST',
            preparationChoice: null,
            version: { increment: 1 },
          },
        });
      }
      if (status === BattleStatus.WON && !next.summonedBoss) {
        const clearedTier = next.encounterTier ?? 1;
        const dryadForest = next.region === 'DRYAD_FOREST';
        const record = await tx.characterWorldState.updateMany({
          where: dryadForest
            ? { characterId, dryadHighestClearedTier: { lt: clearedTier } }
            : { characterId, highestClearedTier: { lt: clearedTier } },
          data: dryadForest
            ? { dryadHighestClearedTier: clearedTier }
            : { highestClearedTier: clearedTier },
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
    const previousState = previous.state as unknown as BattleState;
    if (previousState.summonedBoss)
      throw new BadRequestException(
        'Summoned bosses do not extend expeditions',
      );
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
            slot: true,
            item: {
              select: {
                definitionId: true,
                damage: true,
                armor: true,
                health: true,
              },
            },
          },
        },
        resources: {
          where: {
            type: {
              in: [ResourceType.HEALTH_POTION, ResourceType.MANA_POTION],
            },
          },
          select: { type: true, balance: true },
        },
      },
    });
    const equipment = sumEquipmentStats(
      character.equipment.map((assignment) => assignment.item),
    );
    const bonuses = this.combatTalentBonuses(character.talents, equipment);
    const loadout = this.combatLoadout(
      character.equipment,
      character.resources,
    );
    const tier = (previousState.encounterTier ?? 1) + 1;
    const dryadForest = previousState.region === 'DRYAD_FOREST';
    const rareEncounter = dryadForest
      ? false
      : await this.reserveRareEncounter(characterId, character.level, tier);
    const next = dryadForest
      ? createDryadForestBattle(
          character.archetype,
          equipment.damage,
          tier,
          character.level,
          bonuses,
          loadout,
        )
      : createBattle(
          character.archetype,
          previousState.preparation,
          equipment.damage,
          tier,
          character.level,
          bonuses,
          rareEncounter,
          loadout,
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
          encounterId: dryadForest
            ? `dryad-forest-tier-${tier}`
            : rareEncounter
              ? 'rare-seal-warden'
              : `hollow-road-tier-${tier}`,
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
          currentLocation: state.returnLocation ?? 'BROKEN_WATCHPOST',
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
      select: {
        status: true,
        state: true,
        rewardClaim: { select: { id: true } },
      },
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
          currentLocation:
            (latestResult?.state as unknown as BattleState | undefined)
              ?.returnLocation ?? 'BROKEN_WATCHPOST',
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
            currentLocation: next.returnLocation ?? 'BROKEN_WATCHPOST',
            preparationChoice: null,
            version: { increment: 1 },
          },
        });
      }
      if (
        result.count === 1 &&
        status === BattleStatus.WON &&
        !next.summonedBoss
      ) {
        const clearedTier = next.encounterTier ?? 1;
        const dryadForest = next.region === 'DRYAD_FOREST';
        const record = await tx.characterWorldState.updateMany({
          where: dryadForest
            ? { characterId, dryadHighestClearedTier: { lt: clearedTier } }
            : { characterId, highestClearedTier: { lt: clearedTier } },
          data: dryadForest
            ? { dryadHighestClearedTier: clearedTier }
            : { highestClearedTier: clearedTier },
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
      rareEncounter: state.rareEncounter ?? false,
      summonedBoss: state.summonedBoss ?? false,
      summonedBossId: state.summonedBossId,
      enemyName:
        state.enemyLabel ??
        ((state.encounterTier ?? 1) > 1
          ? 'Загартований Завісою розоритель'
          : 'Спотворений Завісою мародер'),
      version: state.version,
      turn: state.turn,
      hero: state.hero,
      enemy: state.enemy,
      enemies: state.enemies?.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        activeTarget: enemy.id === state.targetEnemyId,
      })) ?? [
        {
          id: 'primary-enemy',
          name: state.enemyLabel,
          health: state.enemy.health,
          maxHealth: state.enemy.maxHealth,
          activeTarget: true,
        },
      ],
      currentIntent: intent,
      visibleIntents: Array.from(
        { length: visibleCount },
        (_, offset) =>
          INTENTS[(state.intentIndex + offset) % INTENTS.length] ?? INTENTS[0],
      ),
      actions: actionsFor(state.archetype, {
        offHandMode: state.offHandMode,
        healthPotions: state.healthPotionCharges ?? 0,
        manaPotions: state.manaPotionCharges ?? 0,
      }),
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

  private combatLoadout(
    equipment: Array<{
      slot: string;
      item: { definitionId: string };
    }>,
    resources: Array<{ type: ResourceType; balance: number }>,
  ): CombatLoadout {
    const offHand = equipment.find(
      (assignment) => assignment.slot === 'OFF_HAND',
    );
    const offHandMode = !offHand
      ? 'EMPTY'
      : offHand.item.definitionId.includes('guard')
        ? 'SHIELD'
        : offHand.item.definitionId.includes('focus')
          ? 'FOCUS'
          : 'WEAPON';
    const balance = (type: ResourceType) =>
      resources.find((resource) => resource.type === type)?.balance ?? 0;
    return {
      offHandMode,
      healthPotions: balance(ResourceType.HEALTH_POTION),
      manaPotions: balance(ResourceType.MANA_POTION),
    };
  }

  private async consumeBattlePotion(
    tx: Prisma.TransactionClient,
    characterId: string,
    actionId: string,
    commandId: string,
  ): Promise<void> {
    const type =
      actionId === 'HEALTH_POTION'
        ? ResourceType.HEALTH_POTION
        : actionId === 'MANA_POTION'
          ? ResourceType.MANA_POTION
          : null;
    if (!type) return;
    const consumed = await tx.characterResource.updateMany({
      where: { characterId, type, balance: { gte: 1 } },
      data: { balance: { decrement: 1 } },
    });
    if (consumed.count !== 1)
      throw new ConflictException('The selected potion is unavailable');
    await tx.resourceLedgerEntry.create({
      data: {
        characterId,
        type,
        amount: -1,
        reason: 'BATTLE_POTION',
        referenceId: commandId,
      },
    });
  }

  private async reserveRareEncounter(
    characterId: string,
    level: number,
    tier: number,
  ): Promise<boolean> {
    if (level < 30) return false;
    const week = rareEncounterWeek(new Date());
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.characterWorldState.findUniqueOrThrow({
        where: { characterId },
      });
      const checks =
        current.rareEncounterWeek === week ? current.rareEncounterChecks : 0;
      const encounters =
        current.rareEncounterWeek === week ? current.rareEncounterCount : 0;
      const digest = createHash('sha256')
        .update(`${characterId}:${week}:${checks}:${tier}`)
        .digest();
      const rare = shouldSpawnRareEncounter({
        level,
        encounters,
        roll: digest.readUInt16BE(0),
        force:
          process.env.NODE_ENV !== 'production' &&
          process.env.VEILFALL_TEST_RARE_ENCOUNTERS === 'true',
      });
      const updated = await tx.characterWorldState.updateMany({
        where: { characterId, version: current.version },
        data: {
          rareEncounterWeek: week,
          rareEncounterChecks: checks + 1,
          rareEncounterCount: encounters + (rare ? 1 : 0),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Rare encounter state changed; retry');
      return rare;
    });
  }
}

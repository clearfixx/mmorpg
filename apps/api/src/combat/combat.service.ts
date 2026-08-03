import { BattleStatus, Prisma } from '@veilfall/database';
import {
  actionsFor,
  createBattle,
  INTENTS,
  resolveTurn,
  type ActionId,
  type BattleState,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { WorldService } from '../world/world.service';
import { SubmitCombatCommandInput } from './dto/submit-combat-command.input';
import { BattleModel } from './models/battle.model';

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
      select: { archetype: true },
    });
    const state = createBattle(character.archetype, context.preparation);
    const battle = await this.prisma.client.battle.create({
      data: {
        characterId: context.characterId,
        activeCharacterId: context.characterId,
        encounterId: 'rift-scarred-marauder-v1',
        seed: 1701,
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
        await tx.characterWorldState.update({
          where: { characterId },
          data: {
            currentLocation: 'BROKEN_WATCHPOST',
            preparationChoice: null,
            version: { increment: 1 },
          },
        });
      }
      return tx.battle.findUniqueOrThrow({ where: { id: battle.id } });
    });
    return this.toModel(updated.id, updated.state as unknown as BattleState);
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
    await this.prisma.client.$transaction([
      this.prisma.client.battle.update({
        where: { id: battle.id },
        data: {
          state: state as unknown as Prisma.InputJsonValue,
          version: state.version,
          status: BattleStatus.RETREATED,
          completedAt: new Date(),
          activeCharacterId: null,
        },
      }),
      this.prisma.client.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: null,
          version: { increment: 1 },
        },
      }),
    ]);
    return this.toModel(battle.id, state);
  }

  async returnToWatchpost(userId: string): Promise<boolean> {
    const characterId = await this.characters.requireIdForUser(userId);
    const active = await this.prisma.client.battle.count({
      where: { characterId, status: BattleStatus.ACTIVE },
    });
    if (active > 0)
      throw new ConflictException('Finish or retreat from battle first');
    const unclaimedVictory = await this.prisma.client.battle.findFirst({
      where: {
        characterId,
        status: BattleStatus.WON,
        resultAcknowledgedAt: null,
        rewardClaim: null,
      },
      select: { id: true },
    });
    if (unclaimedVictory)
      throw new ConflictException('Claim the battle reward before returning');
    await this.prisma.client.$transaction([
      this.prisma.client.battle.updateMany({
        where: {
          characterId,
          status: { not: BattleStatus.ACTIVE },
          resultAcknowledgedAt: null,
        },
        data: { resultAcknowledgedAt: new Date() },
      }),
      this.prisma.client.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: null,
          version: { increment: 1 },
        },
      }),
    ]);
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
    const result = await this.prisma.client.battle.updateMany({
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
        activeCharacterId: status === BattleStatus.ACTIVE ? characterId : null,
      },
    });
    if (result.count !== 1) {
      const current = await this.prisma.client.battle.findUniqueOrThrow({
        where: { id: battleId },
      });
      return this.toModel(
        current.id,
        current.state as unknown as BattleState,
        current.pendingState ? 'ENEMY_RESOLVING' : undefined,
      );
    }
    if (status === BattleStatus.LOST)
      await this.prisma.client.characterWorldState.update({
        where: { characterId },
        data: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: null,
          version: { increment: 1 },
        },
      });
    return this.toModel(
      battle.id,
      next,
      status === BattleStatus.ACTIVE ? 'PLAYER_TURN' : 'COMPLETED',
    );
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
}

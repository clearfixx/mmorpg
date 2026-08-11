import {
  PreparationChoice,
  WorldLocation,
  type VeilfallPrismaClient,
} from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CINDERHAVEN_UNLOCK_TIER } from '@veilfall/game-engine';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { PrepareLocationInput } from './dto/prepare-location.input';
import { TravelInput } from './dto/travel.input';
import { WorldMapModel, WorldStateModel } from './models/world-state.model';

type TransactionClient = Parameters<
  Parameters<VeilfallPrismaClient['$transaction']>[0]
>[0];

@Injectable()
export class WorldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async currentForUser(userId: string): Promise<WorldStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const state = await this.prisma.client.characterWorldState.upsert({
      where: { characterId },
      create: { characterId },
      update: {},
    });
    return this.toModel(state);
  }

  async mapForUser(userId: string): Promise<WorldMapModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const state = await this.prisma.client.characterWorldState.upsert({
      where: { characterId },
      create: { characterId },
      update: {},
    });
    const cinderhaven = state.cinderhavenUnlocked;
    return {
      nodes: [
        node('DAWN_LANDS', 'Землі Світанку', 'Лобі', 'CURRENT', null),
        node(
          'BROKEN_WATCHPOST',
          'Зламана застава',
          'Передбойовий рубіж',
          'AVAILABLE',
          null,
        ),
        node(
          'HOLLOW_ROAD',
          'Порожня дорога',
          'PvE-маршрут',
          'AVAILABLE',
          50,
          `Пройдено ${Math.min(state.highestClearedTier, CINDERHAVEN_UNLOCK_TIER)}/${CINDERHAVEN_UNLOCK_TIER}`,
        ),
        node(
          'CINDERHAVEN',
          'Попелястий Прихисток',
          'Нейтральний міський хаб',
          cinderhaven ? 'AVAILABLE' : 'LOCKED',
          null,
          cinderhaven
            ? 'Шлях відкрито'
            : `Відкривається після етапу ${CINDERHAVEN_UNLOCK_TIER}`,
        ),
        node(
          'DRYAD_FOREST',
          'Ліс дріад',
          'PvE-регіон',
          cinderhaven ? 'AVAILABLE' : 'LOCKED',
          70,
          cinderhaven
            ? `Пройдено ${state.dryadHighestClearedTier}/70`
            : 'Спочатку дістаньтеся Попелястого Прихистку',
        ),
        node(
          'DAWN_WATCHTOWER',
          'Вежа спостерігачів',
          'Майбутній форпост',
          'FUTURE',
          null,
        ),
        node(
          'CONTESTED_FORTRESS',
          'Фортеця Спірних земель',
          'Центральний фронт',
          'FUTURE',
          null,
        ),
        node(
          'TWILIGHT_WATCHTOWER',
          'Сутінкова вежа',
          'Майбутній форпост',
          'FUTURE',
          null,
        ),
        node(
          'DARK_DRYAD_FOREST',
          'Ліс темних дріад',
          'Майбутній PvE-регіон',
          'FUTURE',
          70,
        ),
        node(
          'ASHEN_REFUGE',
          'Прихисток Присмерку',
          'Майбутній міський хаб',
          'FUTURE',
          null,
        ),
        node(
          'FADING_ROAD',
          'Згасаюча дорога',
          'Майбутній PvE-маршрут',
          'FUTURE',
          50,
        ),
        node(
          'TWILIGHT_WATCHPOST',
          'Сутінкова застава',
          'Майбутній рубіж',
          'FUTURE',
          null,
        ),
        node(
          'ASHEN_LANDS',
          'Землі Присмерку',
          'Майбутнє лобі сторони',
          'FUTURE',
          null,
        ),
      ],
    };
  }

  async encounterContext(userId: string) {
    const characterId = await this.characters.requireIdForUser(userId);
    const state = await this.prisma.client.characterWorldState.findUnique({
      where: { characterId },
    });
    if (
      !state ||
      (state.currentLocation !== WorldLocation.HOLLOW_ROAD &&
        state.currentLocation !== WorldLocation.DRYAD_FOREST) ||
      (state.currentLocation === WorldLocation.HOLLOW_ROAD &&
        !state.preparationChoice)
    )
      throw new BadRequestException('Travel to the encounter first');
    const dryadForest = state.currentLocation === WorldLocation.DRYAD_FOREST;
    return {
      characterId,
      preparation: dryadForest
        ? PreparationChoice.REST_BRAZIER
        : state.preparationChoice!,
      checkpointTier: dryadForest
        ? state.dryadGuideCheckpointTier
        : state.guideCheckpointTier,
      region: dryadForest
        ? ('DRYAD_FOREST' as const)
        : ('HOLLOW_ROAD' as const),
    };
  }

  async prepare(
    userId: string,
    input: PrepareLocationInput,
  ): Promise<WorldStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash('LOCATION_PREPARE', input.choice);
    return this.executeIdempotently(
      characterId,
      input.idempotencyKey,
      'LOCATION_PREPARE',
      payloadHash,
      async (tx) => {
        const updated = await tx.characterWorldState.updateMany({
          where: {
            characterId,
            version: input.expectedVersion,
            currentLocation: WorldLocation.BROKEN_WATCHPOST,
          },
          data: {
            preparationChoice: input.choice,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('World state changed; refresh and retry');
      },
    );
  }

  async travel(userId: string, input: TravelInput): Promise<WorldStateModel> {
    if (
      input.destination !== WorldLocation.HOLLOW_ROAD &&
      input.destination !== WorldLocation.CINDERHAVEN_GATE &&
      input.destination !== WorldLocation.BROKEN_WATCHPOST &&
      input.destination !== WorldLocation.DRYAD_FOREST
    )
      throw new BadRequestException('Destination is currently locked');

    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash('WORLD_TRAVEL', input.destination);
    return this.executeIdempotently(
      characterId,
      input.idempotencyKey,
      'WORLD_TRAVEL',
      payloadHash,
      async (tx) => {
        const requiresPreparation =
          input.destination === WorldLocation.HOLLOW_ROAD;
        const returningFromCinderhaven =
          input.destination === WorldLocation.BROKEN_WATCHPOST;
        const enteringDryadForest =
          input.destination === WorldLocation.DRYAD_FOREST;
        const updated = await tx.characterWorldState.updateMany({
          where: {
            characterId,
            version: input.expectedVersion,
            currentLocation: enteringDryadForest
              ? WorldLocation.CINDERHAVEN_GATE
              : returningFromCinderhaven
                ? WorldLocation.CINDERHAVEN_GATE
                : WorldLocation.BROKEN_WATCHPOST,
            ...(returningFromCinderhaven
              ? {}
              : requiresPreparation
                ? { preparationChoice: { not: null } }
                : { cinderhavenUnlocked: true }),
          },
          data: {
            currentLocation: input.destination,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'Destination is locked or world state has changed',
          );
      },
    );
  }

  private async executeIdempotently(
    characterId: string,
    idempotencyKey: string,
    commandType: string,
    payloadHash: string,
    mutate: (tx: TransactionClient) => Promise<void>,
  ): Promise<WorldStateModel> {
    const existing = await this.prisma.client.worldCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
    if (existing)
      return this.resolveExisting(
        characterId,
        existing.payloadHash,
        payloadHash,
      );

    try {
      const state = await this.prisma.client.$transaction(async (tx) => {
        await mutate(tx);
        await tx.worldCommand.create({
          data: {
            characterId,
            idempotencyKey,
            commandType,
            payloadHash,
          },
        });
        return tx.characterWorldState.findUniqueOrThrow({
          where: { characterId },
        });
      });
      return this.toModel(state);
    } catch (error) {
      const raced = await this.prisma.client.worldCommand.findUnique({
        where: {
          characterId_idempotencyKey: { characterId, idempotencyKey },
        },
      });
      if (raced)
        return this.resolveExisting(
          characterId,
          raced.payloadHash,
          payloadHash,
        );
      throw error;
    }
  }

  private async resolveExisting(
    characterId: string,
    storedHash: string,
    requestedHash: string,
  ): Promise<WorldStateModel> {
    if (storedHash !== requestedHash)
      throw new ConflictException(
        'Idempotency key was used for another command',
      );
    const state =
      await this.prisma.client.characterWorldState.findUniqueOrThrow({
        where: { characterId },
      });
    return this.toModel(state);
  }

  private toModel(state: {
    characterId: string;
    currentLocation: WorldLocation;
    preparationChoice: PreparationChoice | null;
    version: number;
    cinderhavenUnlocked: boolean;
    highestClearedTier: number;
    dryadHighestClearedTier: number;
  }): WorldStateModel {
    return {
      ...state,
      cinderhavenUnlockTier: CINDERHAVEN_UNLOCK_TIER,
      watchpostVoices: watchpostVoices(state.characterId),
      routes:
        state.currentLocation === WorldLocation.BROKEN_WATCHPOST
          ? [
              {
                destination: WorldLocation.HOLLOW_ROAD,
                locked: state.preparationChoice === null,
                lockReason:
                  state.preparationChoice === null
                    ? 'Спочатку підготуйтеся до дороги'
                    : null,
              },
              {
                destination: WorldLocation.CINDERHAVEN_GATE,
                locked: !state.cinderhavenUnlocked,
                lockReason: state.cinderhavenUnlocked
                  ? null
                  : `Подолайте ${CINDERHAVEN_UNLOCK_TIER}-й етап Порожньої дороги`,
              },
            ]
          : state.currentLocation === WorldLocation.CINDERHAVEN_GATE
            ? [
                {
                  destination: WorldLocation.BROKEN_WATCHPOST,
                  locked: false,
                  lockReason: null,
                },
                {
                  destination: WorldLocation.DRYAD_FOREST,
                  locked: false,
                  lockReason: null,
                },
              ]
            : state.currentLocation === WorldLocation.DRYAD_FOREST
              ? [
                  {
                    destination: WorldLocation.CINDERHAVEN_GATE,
                    locked: true,
                    lockReason:
                      'Повернення відкриється після завершення сутички',
                  },
                ]
              : [
                  {
                    destination: WorldLocation.BROKEN_WATCHPOST,
                    locked: true,
                    lockReason: 'Повернення відкриється разом із сутичкою',
                  },
                ],
    };
  }

  private hash(command: string, value: string): string {
    return createHash('sha256').update(`${command}:${value}`).digest('hex');
  }
}

function node(
  id: string,
  name: string,
  kind: string,
  status: string,
  stages: number | null,
  note: string | null = null,
) {
  return { id, name, kind, status, stages, note };
}

const WATCHPOST_VOICES = [
  [
    'Вартова Мейра',
    'часова',
    'Ворожих розвідників бачили коло Лісу дріад. Або то знову дерева навчилися ходити.',
  ],
  [
    'Старий Горн',
    'ветеран',
    'Колись і мене кликала дорога пригод. Тепер моє коліно сперечається навіть із погодою.',
  ],
  [
    'Спостерігач Руно',
    'спостерігач',
    'На Порожній дорозі надто тихо. Така тиша зазвичай має зуби.',
  ],
  [
    'Кухар Брам',
    'вартовий кухні',
    'Якщо казан почне шепотіти — не відповідай. Минулого разу ми втратили ополоник.',
  ],
  [
    'Писарка Ельда',
    'літописиця',
    'Застава пам’ятає кожного, хто повернувся. І особливо тих, хто не повернув борг.',
  ],
] as const;

function watchpostVoices(characterId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const seed = createHash('sha256').update(`${characterId}:${day}`).digest();
  return [0, 1, 2].map((offset) => {
    const [name, role, line] =
      WATCHPOST_VOICES[seed[offset] % WATCHPOST_VOICES.length];
    return { id: `${day}-${offset}`, name, role, line };
  });
}

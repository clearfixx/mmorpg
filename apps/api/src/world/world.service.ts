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

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { PrepareLocationInput } from './dto/prepare-location.input';
import { TravelInput } from './dto/travel.input';
import { WorldStateModel } from './models/world-state.model';

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

  async encounterContext(userId: string) {
    const characterId = await this.characters.requireIdForUser(userId);
    const state = await this.prisma.client.characterWorldState.findUnique({
      where: { characterId },
    });
    if (
      !state ||
      state.currentLocation !== WorldLocation.HOLLOW_ROAD ||
      !state.preparationChoice
    )
      throw new BadRequestException('Travel to the encounter first');
    return { characterId, preparation: state.preparationChoice };
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
    if (input.destination !== WorldLocation.HOLLOW_ROAD)
      throw new BadRequestException('Destination is currently locked');

    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash('WORLD_TRAVEL', input.destination);
    return this.executeIdempotently(
      characterId,
      input.idempotencyKey,
      'WORLD_TRAVEL',
      payloadHash,
      async (tx) => {
        const updated = await tx.characterWorldState.updateMany({
          where: {
            characterId,
            version: input.expectedVersion,
            currentLocation: WorldLocation.BROKEN_WATCHPOST,
            preparationChoice: { not: null },
          },
          data: {
            currentLocation: input.destination,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'Preparation is required or world state has changed',
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
    currentLocation: WorldLocation;
    preparationChoice: PreparationChoice | null;
    version: number;
    cinderhavenUnlocked: boolean;
  }): WorldStateModel {
    return {
      ...state,
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
                  : 'Шлях відкриється після першої перемоги',
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

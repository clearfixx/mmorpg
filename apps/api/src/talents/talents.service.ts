import { ResourceType, TalentType, WorldLocation } from '@veilfall/database';
import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { UpgradeTalentInput } from './dto/upgrade-talent.input';
import { TalentTreeModel } from './models/talent-tree.model';

const DEFINITIONS = {
  [TalentType.VITALITY]: {
    name: 'Живучість',
    description: '+12 до максимального здоров’я за ранг.',
    requiredLevel: 1,
    effectPerRank: 12,
  },
  [TalentType.POWER]: {
    name: 'Сила',
    description: '+3 до шкоди за ранг.',
    requiredLevel: 2,
    effectPerRank: 3,
  },
  [TalentType.RESILIENCE]: {
    name: 'Стійкість',
    description: '+2 до броні за ранг.',
    requiredLevel: 3,
    effectPerRank: 2,
  },
} as const;

@Injectable()
export class TalentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<TalentTreeModel> {
    return this.read(await this.characters.requireIdForUser(userId));
  }

  async upgrade(
    userId: string,
    input: UpgradeTalentInput,
  ): Promise<TalentTreeModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(`${input.type}:${input.expectedCharacterVersion}`)
      .digest('hex');
    const existing = await this.prisma.client.talentCommand.findUnique({
      where: {
        characterId_idempotencyKey: {
          characterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Command key was used for another talent');
      return this.read(characterId);
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const character = await tx.character.findUniqueOrThrow({
          where: { id: characterId },
          include: { talents: true, worldState: true, resources: true },
        });
        if (
          character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException('Talents are trained in Cinderhaven');
        const definition = DEFINITIONS[input.type];
        const spent = character.talents.reduce(
          (total, talent) => total + talent.rank,
          0,
        );
        const currentRank =
          character.talents.find((talent) => talent.type === input.type)
            ?.rank ?? 0;
        if (character.level < definition.requiredLevel)
          throw new ConflictException('Talent is still locked');
        if (character.level - 1 - spent < 1)
          throw new ConflictException('No talent points available');
        if (currentRank >= 10)
          throw new ConflictException('Talent has reached maximum rank');
        const cost = this.costForRank(currentRank + 1);
        const paid = await tx.characterResource.updateMany({
          where: {
            characterId,
            type: cost.type,
            balance: { gte: cost.amount },
          },
          data: { balance: { decrement: cost.amount } },
        });
        if (paid.count !== 1)
          throw new ConflictException('Not enough resources');
        const updated = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Character state changed');
        await tx.characterTalent.upsert({
          where: { characterId_type: { characterId, type: input.type } },
          create: { characterId, type: input.type, rank: 1 },
          update: { rank: { increment: 1 } },
        });
        await tx.talentCommand.create({
          data: {
            characterId,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
          },
        });
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type: cost.type,
            amount: -cost.amount,
            reason: 'TALENT_UPGRADE',
            referenceId: input.idempotencyKey,
          },
        });
      });
      return this.read(characterId);
    } catch (error) {
      const raced = await this.prisma.client.talentCommand.findUnique({
        where: {
          characterId_idempotencyKey: {
            characterId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (raced?.payloadHash === payloadHash) return this.read(characterId);
      throw error;
    }
  }

  private async read(characterId: string): Promise<TalentTreeModel> {
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      include: { talents: true, resources: true },
    });
    const ranks = new Map(
      character.talents.map((talent) => [talent.type, talent.rank]),
    );
    const spent = character.talents.reduce(
      (total, talent) => total + talent.rank,
      0,
    );
    const resources = new Map(
      character.resources.map((resource) => [resource.type, resource.balance]),
    );
    return {
      characterVersion: character.version,
      availablePoints: Math.max(0, character.level - 1 - spent),
      talents: Object.values(TalentType).map((type) => {
        const rank = ranks.get(type) ?? 0;
        const cost = this.costForRank(rank + 1);
        return {
          type,
          ...DEFINITIONS[type],
          rank,
          maxRank: 10,
          unlocked: character.level >= DEFINITIONS[type].requiredLevel,
          costResource: cost.type,
          costAmount: cost.amount,
          affordable: (resources.get(cost.type) ?? 0) >= cost.amount,
        };
      }),
      resources: Object.values(ResourceType).map((type) => ({
        type,
        amount: resources.get(type) ?? 0,
      })),
    };
  }

  private costForRank(rank: number): { type: ResourceType; amount: number } {
    if (rank >= 7) return { type: ResourceType.BRONZE, amount: (rank - 6) * 8 };
    if (rank >= 4)
      return { type: ResourceType.COPPER, amount: (rank - 3) * 10 };
    return { type: ResourceType.IRON, amount: rank * 12 };
  }
}

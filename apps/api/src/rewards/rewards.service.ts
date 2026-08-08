import {
  BattleStatus,
  CharacterArchetype,
  ItemBinding,
  ItemLineageType,
  ItemLocation,
  ItemRarity,
  ResourceType,
} from '@veilfall/database';
import { progressionForExperience } from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { ClaimBattleRewardInput } from './dto/claim-battle-reward.input';
import { BattleRewardModel } from './models/battle-reward.model';

const REWARDS = {
  [CharacterArchetype.VANGUARD]: {
    definitionId: 'veteran-notched-blade-v1',
    name: 'Зазубрений клинок Ветерана',
    visualAssetId: 'weapon-veteran-blade-01',
  },
  [CharacterArchetype.RANGER]: {
    definitionId: 'veteran-ashwood-bow-v1',
    name: 'Ясеневий лук Ветерана',
    visualAssetId: 'weapon-veteran-bow-01',
  },
  [CharacterArchetype.ARCANIST]: {
    definitionId: 'veteran-cracked-focus-v1',
    name: 'Тріснутий фокус Ветерана',
    visualAssetId: 'weapon-veteran-focus-01',
  },
} as const;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async claim(
    userId: string,
    input: ClaimBattleRewardInput,
  ): Promise<BattleRewardModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const existing = await this.prisma.client.rewardClaim.findUnique({
      where: { battleId: input.battleId },
      include: { item: true },
    });
    if (existing) {
      if (existing.characterId !== characterId)
        throw new BadRequestException('Battle reward is unavailable');
      return this.toModel(existing);
    }

    const battle = await this.prisma.client.battle.findFirst({
      where: {
        id: input.battleId,
        characterId,
        status: BattleStatus.WON,
      },
      include: { character: { select: { archetype: true } } },
    });
    if (!battle) throw new BadRequestException('Won battle is required');

    const definition = REWARDS[battle.character.archetype];
    const tier =
      (battle.state as unknown as { encounterTier?: number }).encounterTier ??
      1;
    const roll = this.rollForBattle(battle.id, tier);
    const experience = 40 + (tier - 1) * 20;
    const gold = 18 + (tier - 1) * 12;
    const resource = this.resourceReward(tier);

    try {
      const claim = await this.prisma.client.$transaction(async (tx) => {
        const createdClaim = await tx.rewardClaim.create({
          data: {
            battleId: battle.id,
            characterId,
            idempotencyKey: input.idempotencyKey,
            experience,
            gold,
            resourceType: resource.type,
            resourceAmount: resource.amount,
          },
        });
        const item = await tx.itemInstance.create({
          data: {
            definitionId: definition.definitionId,
            ownerId: characterId,
            sourceBattleId: battle.id,
            rewardClaimId: createdClaim.id,
            itemLevel: 1,
            rarity: roll.rarity,
            damage: roll.damage,
            binding: ItemBinding.BOUND_ON_EQUIP,
            location: tier === 1 ? ItemLocation.CHEST : ItemLocation.BACKPACK,
            setId: 'veteran',
            visualAssetId: definition.visualAssetId,
          },
        });
        await tx.itemLineageEvent.create({
          data: {
            itemId: item.id,
            type: ItemLineageType.CREATED_FROM_BATTLE_REWARD,
            payload: {
              battleId: battle.id,
              encounterId: battle.encounterId,
            },
          },
        });
        const progressedCharacter = await tx.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: experience },
            gold: { increment: gold },
            version: { increment: 1 },
          },
        });
        const progression = progressionForExperience(
          progressedCharacter.experience,
        );
        await tx.character.updateMany({
          where: { id: characterId, level: { lt: progression.level } },
          data: { level: progression.level },
        });
        await tx.characterResource.upsert({
          where: {
            characterId_type: { characterId, type: resource.type },
          },
          create: {
            characterId,
            type: resource.type,
            balance: resource.amount,
          },
          update: { balance: { increment: resource.amount } },
        });
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type: resource.type,
            amount: resource.amount,
            reason: 'BATTLE_REWARD',
            referenceId: createdClaim.id,
          },
        });
        await tx.characterWorldState.update({
          where: { characterId },
          data: {
            cinderhavenUnlocked: true,
            version: { increment: 1 },
          },
        });
        return tx.rewardClaim.findUniqueOrThrow({
          where: { id: createdClaim.id },
          include: { item: true },
        });
      });
      return this.toModel(claim);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const raced = await this.prisma.client.rewardClaim.findUnique({
        where: { battleId: battle.id },
        include: { item: true },
      });
      if (!raced || raced.characterId !== characterId)
        throw new ConflictException('Reward claim conflicted; retry');
      return this.toModel(raced);
    }
  }

  private rollForBattle(
    battleId: string,
    tier: number,
  ): {
    rarity: ItemRarity;
    damage: number;
  } {
    const digest = createHash('sha256')
      .update(`first-reward:${battleId}`)
      .digest();
    const rarity =
      digest[0] % 4 === 0 ? ItemRarity.UNCOMMON : ItemRarity.COMMON;
    const damage =
      4 +
      (digest[1] % 4) +
      (rarity === ItemRarity.UNCOMMON ? 1 : 0) +
      (tier - 1) * 2;
    return { rarity, damage };
  }

  private resourceReward(tier: number): {
    type: ResourceType;
    amount: number;
  } {
    if (tier >= 5) return { type: ResourceType.BRONZE, amount: 8 + tier * 2 };
    if (tier >= 3) return { type: ResourceType.COPPER, amount: 12 + tier * 3 };
    return { type: ResourceType.IRON, amount: 10 + tier * 10 };
  }

  private toModel(claim: {
    id: string;
    battleId: string;
    experience: number;
    gold: number;
    resourceType: ResourceType;
    resourceAmount: number;
    item: {
      id: string;
      definitionId: string;
      itemLevel: number;
      rarity: ItemRarity;
      damage: number;
      binding: ItemBinding;
      location: ItemLocation;
      setId: string;
      visualAssetId: string;
    } | null;
  }): BattleRewardModel {
    if (!claim.item) throw new ConflictException('Reward item is incomplete');
    const definition = Object.values(REWARDS).find(
      (candidate) => candidate.definitionId === claim.item?.definitionId,
    );
    if (!definition)
      throw new ConflictException('Reward definition is missing');
    return {
      claimId: claim.id,
      battleId: claim.battleId,
      experience: claim.experience,
      gold: claim.gold,
      resources: [{ type: claim.resourceType, amount: claim.resourceAmount }],
      item: {
        ...claim.item,
        name: definition.name,
        setName: 'Ветеран',
      },
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}

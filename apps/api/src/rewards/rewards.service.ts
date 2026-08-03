import {
  BattleStatus,
  CharacterArchetype,
  ItemBinding,
  ItemLineageType,
  ItemRarity,
} from '@veilfall/database';
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

    try {
      const claim = await this.prisma.client.$transaction(async (tx) => {
        const createdClaim = await tx.rewardClaim.create({
          data: {
            battleId: battle.id,
            characterId,
            idempotencyKey: input.idempotencyKey,
            experience,
            gold,
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
        await tx.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: experience },
            gold: { increment: gold },
            version: { increment: 1 },
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

  private toModel(claim: {
    id: string;
    battleId: string;
    experience: number;
    gold: number;
    item: {
      id: string;
      definitionId: string;
      itemLevel: number;
      rarity: ItemRarity;
      damage: number;
      binding: ItemBinding;
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

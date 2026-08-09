import {
  BattleStatus,
  ItemBinding,
  ItemLineageType,
  ItemLocation,
  ItemRarity,
  ResourceType,
} from '@veilfall/database';
import {
  itemDamageRange,
  itemLevelForReward,
  maxRarityForEncounterTier,
  progressionForExperience,
  rarityForRoll,
  rollItemPower,
  shouldDropEquipment,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { equipmentSlotsForDefinition } from '../inventory/inventory.service';
import {
  itemDefinition,
  itemStatsForPower,
  rewardDefinitionFor,
  type ItemDefinition,
} from '../inventory/item-catalog';
import { resourceBalance } from '../resources/resource-catalog';
import { ClaimBattleRewardInput } from './dto/claim-battle-reward.input';
import { BattleRewardModel } from './models/battle-reward.model';

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
      include: { character: { select: { archetype: true, level: true } } },
    });
    if (!battle) throw new BadRequestException('Won battle is required');

    const tier =
      (battle.state as unknown as { encounterTier?: number }).encounterTier ??
      1;
    const definition = rewardDefinitionFor(battle.character.archetype, tier);
    const rewardDigest = createHash('sha256')
      .update(`equipment-drop:${battle.id}`)
      .digest();
    const dropsItem = shouldDropEquipment(tier, rewardDigest.readUInt16BE(0));
    const roll = this.rollForBattle(
      battle.id,
      battle.character.level,
      tier,
      definition,
    );
    const experience = 40 + (tier - 1) * 20;
    const gold = 18 + (tier - 1) * 12;
    const rareEncounter =
      (battle.state as unknown as { rareEncounter?: boolean }).rareEncounter ===
      true;
    const resource = rareEncounter
      ? { type: ResourceType.BOSS_INVOCATION_SEAL, amount: 1 }
      : this.resourceReward(tier);

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
        if (dropsItem) {
          const item = await tx.itemInstance.create({
            data: {
              definitionId: definition.definitionId,
              ownerId: characterId,
              sourceBattleId: battle.id,
              rewardClaimId: createdClaim.id,
              itemLevel: roll.itemLevel,
              rarity: roll.rarity,
              rollQuality: roll.rollQuality,
              damage: roll.damage,
              armor: roll.armor,
              health: roll.health,
              binding: ItemBinding.BOUND_ON_EQUIP,
              location: tier === 1 ? ItemLocation.CHEST : ItemLocation.BACKPACK,
              setId: definition.setId,
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
                itemLevel: roll.itemLevel,
                rarity: roll.rarity,
                rollQuality: roll.rollQuality,
                damageRange: { min: roll.damageMin, max: roll.damageMax },
                stats: {
                  damage: roll.damage,
                  armor: roll.armor,
                  health: roll.health,
                },
              },
            },
          });
        }
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
    characterLevel: number,
    tier: number,
    definition: ItemDefinition,
  ): {
    itemLevel: number;
    rarity: ItemRarity;
    rollQuality: number;
    damage: number;
    armor: number;
    health: number;
    damageMin: number;
    damageMax: number;
  } {
    const digest = createHash('sha256')
      .update(`first-reward:${battleId}`)
      .digest();
    const itemLevel = itemLevelForReward(characterLevel, tier);
    const rarity = rarityForRoll(
      digest.readUInt16BE(0),
      maxRarityForEncounterTier(tier),
    );
    const power = rollItemPower(
      itemLevel,
      rarity,
      digest.readUInt16BE(2) % 10_000,
    );
    const stats = itemStatsForPower(power.value, definition.statWeights);
    return {
      itemLevel,
      rarity,
      rollQuality: power.rollQuality,
      ...stats,
      damageMin: power.min,
      damageMax: power.max,
    };
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
      rollQuality: number;
      damage: number;
      armor: number;
      health: number;
      binding: ItemBinding;
      location: ItemLocation;
      setId: string;
      visualAssetId: string;
    } | null;
  }): BattleRewardModel {
    if (!claim.item)
      return {
        claimId: claim.id,
        battleId: claim.battleId,
        experience: claim.experience,
        gold: claim.gold,
        resources: [resourceBalance(claim.resourceType, claim.resourceAmount)],
        item: null,
      };
    const definition = itemDefinition(claim.item.definitionId);
    if (!definition)
      throw new ConflictException('Reward definition is missing');
    const damageRange = itemDamageRange(
      claim.item.itemLevel,
      claim.item.rarity,
    );
    return {
      claimId: claim.id,
      battleId: claim.battleId,
      experience: claim.experience,
      gold: claim.gold,
      resources: [resourceBalance(claim.resourceType, claim.resourceAmount)],
      item: {
        ...claim.item,
        damageMin: damageRange.min,
        damageMax: damageRange.max,
        compatibleSlots: equipmentSlotsForDefinition(claim.item.definitionId),
        name: definition.name,
        setName: definition.setName,
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

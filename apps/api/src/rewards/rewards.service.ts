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
  canUnlockCinderhaven,
  dryadForestResourceDrops,
  hollowRoadResourceDrops,
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

export function invocationSealRewardAmount(): number {
  if (process.env.NODE_ENV === 'production') return 1;
  const configured = Number.parseInt(
    process.env.VEILFALL_TEST_INVOCATION_SEALS ?? '',
    10,
  );
  return Number.isFinite(configured)
    ? Math.min(1_000, Math.max(1, configured))
    : 1;
}

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
      include: { item: true, resources: true },
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
    const summonedBossId = (
      battle.state as unknown as { summonedBossId?: string }
    ).summonedBossId;
    const summonedBoss =
      (battle.state as unknown as { summonedBoss?: boolean }).summonedBoss ===
      true;
    const resources = summonedBoss
      ? summonedBossId === 'FALLEN_ELF'
        ? [{ type: ResourceType.FALLEN_ELF_EYE, amount: 1 }]
        : [{ type: ResourceType.CURSED_HEART, amount: 1 }]
      : rareEncounter
        ? [
            {
              type: ResourceType.BOSS_INVOCATION_SEAL,
              amount: invocationSealRewardAmount(),
            },
          ]
        : this.resourceRewards(
            battle.id,
            (battle.state as unknown as { region?: string }).region,
          );
    const legacyResource = resources[0] ?? {
      type: ResourceType.IRON,
      amount: 0,
    };

    try {
      const claim = await this.prisma.client.$transaction(async (tx) => {
        const createdClaim = await tx.rewardClaim.create({
          data: {
            battleId: battle.id,
            characterId,
            idempotencyKey: input.idempotencyKey,
            experience,
            gold,
            resourceType: legacyResource.type,
            resourceAmount: legacyResource.amount,
            resources: resources.length
              ? { createMany: { data: resources } }
              : undefined,
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
        for (const resource of resources) {
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
        }
        if (!summonedBoss && canUnlockCinderhaven(tier)) {
          await tx.characterWorldState.update({
            where: { characterId },
            data: {
              cinderhavenUnlocked: true,
              version: { increment: 1 },
            },
          });
        }
        return tx.rewardClaim.findUniqueOrThrow({
          where: { id: createdClaim.id },
          include: { item: true, resources: true },
        });
      });
      return this.toModel(claim);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const raced = await this.prisma.client.rewardClaim.findUnique({
        where: { battleId: battle.id },
        include: { item: true, resources: true },
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

  private resourceRewards(
    battleId: string,
    region?: string,
  ): Array<{ type: ResourceType; amount: number }> {
    const digest = createHash('sha256')
      .update(`hollow-road-resources:${battleId}`)
      .digest();
    const rolls = [
      digest[0] % 100,
      digest[1] % 100,
      digest[2] % 100,
      digest[3] % 100,
    ];
    const drops =
      region === 'DRYAD_FOREST'
        ? dryadForestResourceDrops(rolls)
        : hollowRoadResourceDrops(rolls);
    return drops.map((resource) => ({
      type: resource.type,
      amount: resource.amount,
    }));
  }

  private toModel(claim: {
    id: string;
    battleId: string;
    experience: number;
    gold: number;
    resourceType: ResourceType;
    resourceAmount: number;
    resources: Array<{ type: ResourceType; amount: number }>;
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
    const resources =
      claim.resources.length > 0
        ? claim.resources.map((resource) =>
            resourceBalance(resource.type, resource.amount),
          )
        : claim.resourceAmount > 0
          ? [resourceBalance(claim.resourceType, claim.resourceAmount)]
          : [];
    if (!claim.item)
      return {
        claimId: claim.id,
        battleId: claim.battleId,
        experience: claim.experience,
        gold: claim.gold,
        resources,
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
      resources,
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

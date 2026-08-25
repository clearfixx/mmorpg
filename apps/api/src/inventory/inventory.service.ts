import {
  CharacterArchetype,
  EquipmentSlot,
  ItemBinding,
  ItemLineageType,
  ItemLocation,
  TalentType,
} from '@veilfall/database';
import {
  itemDamageRange,
  levelBonuses,
  activeEquipmentSetBonuses,
  equipmentSetBonusProgress,
  sumEquipmentWithSetBonuses,
  talentBonuses,
  type ItemRarity as EngineItemRarity,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { EquipItemInput } from './dto/equip-item.input';
import { UnequipItemInput } from './dto/unequip-item.input';
import { itemDefinition } from './item-catalog';
import { InventoryItemModel, InventoryModel } from './models/inventory.model';
import { withTemperedStats } from './tempered-item';
import { canItemPerformInventoryAction } from '../tempering/tempering-item-capability';

const BASE_DAMAGE = {
  [CharacterArchetype.VANGUARD]: 16,
  [CharacterArchetype.RANGER]: 19,
  [CharacterArchetype.ARCANIST]: 21,
};

const BASE_HEALTH = {
  [CharacterArchetype.VANGUARD]: 140,
  [CharacterArchetype.RANGER]: 100,
  [CharacterArchetype.ARCANIST]: 90,
};

const BASE_ARMOR = {
  [CharacterArchetype.VANGUARD]: 14,
  [CharacterArchetype.RANGER]: 7,
  [CharacterArchetype.ARCANIST]: 6,
};

export function isEquipmentSlotCompatible(
  definitionId: string,
  slot: EquipmentSlot,
): boolean {
  return itemDefinition(definitionId)?.equipmentSlots.includes(slot) ?? false;
}

export function equipmentSlotsForDefinition(
  definitionId: string,
): EquipmentSlot[] {
  return [...(itemDefinition(definitionId)?.equipmentSlots ?? [])];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<InventoryModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    return this.read(characterId);
  }

  async equip(userId: string, input: EquipItemInput): Promise<InventoryModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(`${input.itemId}:${input.slot}:${input.expectedCharacterVersion}`)
      .digest('hex');
    const existing = await this.prisma.client.inventoryCommand.findUnique({
      where: {
        characterId_idempotencyKey: {
          characterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Command key was used for another item');
      return this.read(characterId);
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const character = await tx.character.findUniqueOrThrow({
          where: { id: characterId },
        });
        const item = await tx.itemInstance.findFirst({
          where: {
            id: input.itemId,
            ownerId: characterId,
            location: ItemLocation.CHEST,
          },
        });
        if (!item)
          throw new BadRequestException('Item is not available in your chest');
        if (!(await canItemPerformInventoryAction(tx, item.id)))
          throw new BadRequestException('Item action is unavailable');
        if (!isEquipmentSlotCompatible(item.definitionId, input.slot))
          throw new BadRequestException('Item is incompatible with this slot');
        if (item.itemLevel > character.level)
          throw new BadRequestException('Character level is too low');
        const version = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (version.count !== 1)
          throw new ConflictException(
            'Character state changed; refresh and retry',
          );
        const current = await tx.equipmentAssignment.findUnique({
          where: { characterId_slot: { characterId, slot: input.slot } },
        });
        if (current) {
          if (!(await canItemPerformInventoryAction(tx, current.itemId)))
            throw new BadRequestException('Item action is unavailable');
          await tx.itemInstance.update({
            where: { id: current.itemId },
            data: { location: ItemLocation.CHEST },
          });
          await tx.equipmentAssignment.delete({ where: { id: current.id } });
        }
        const moved = await tx.itemInstance.updateMany({
          where: {
            id: item.id,
            ownerId: characterId,
            location: ItemLocation.CHEST,
          },
          data: { location: ItemLocation.EQUIPPED, binding: ItemBinding.BOUND },
        });
        if (moved.count !== 1)
          throw new ConflictException('Item state changed');
        await tx.equipmentAssignment.create({
          data: { characterId, itemId: item.id, slot: input.slot },
        });
        await tx.itemLineageEvent.create({
          data: {
            itemId: item.id,
            type: ItemLineageType.EQUIPPED,
            payload: {
              slot: input.slot,
              characterVersion: input.expectedCharacterVersion + 1,
            },
          },
        });
        await tx.inventoryCommand.create({
          data: {
            characterId,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
          },
        });
      });
      return this.read(characterId);
    } catch (error) {
      const raced = await this.prisma.client.inventoryCommand.findUnique({
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

  async unequip(
    userId: string,
    input: UnequipItemInput,
  ): Promise<InventoryModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(`UNEQUIP:${input.slot}:${input.expectedCharacterVersion}`)
      .digest('hex');
    const existing = await this.prisma.client.inventoryCommand.findUnique({
      where: {
        characterId_idempotencyKey: {
          characterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Command key was used for another slot');
      return this.read(characterId);
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const version = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (version.count !== 1)
          throw new ConflictException(
            'Character state changed; refresh and retry',
          );
        const assignment = await tx.equipmentAssignment.findUnique({
          where: { characterId_slot: { characterId, slot: input.slot } },
        });
        if (!assignment)
          throw new BadRequestException('Equipment slot is already empty');
        if (!(await canItemPerformInventoryAction(tx, assignment.itemId)))
          throw new BadRequestException('Item action is unavailable');
        await tx.equipmentAssignment.delete({ where: { id: assignment.id } });
        const moved = await tx.itemInstance.updateMany({
          where: {
            id: assignment.itemId,
            ownerId: characterId,
            location: ItemLocation.EQUIPPED,
          },
          data: { location: ItemLocation.CHEST },
        });
        if (moved.count !== 1)
          throw new ConflictException('Equipped item state changed');
        await tx.itemLineageEvent.create({
          data: {
            itemId: assignment.itemId,
            type: ItemLineageType.EQUIPPED,
            payload: {
              action: 'UNEQUIPPED',
              slot: input.slot,
              characterVersion: input.expectedCharacterVersion + 1,
            },
          },
        });
        await tx.inventoryCommand.create({
          data: {
            characterId,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
          },
        });
      });
      return this.read(characterId);
    } catch (error) {
      const raced = await this.prisma.client.inventoryCommand.findUnique({
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

  private async read(characterId: string): Promise<InventoryModel> {
    const [character, activeTempering] = await Promise.all([
      this.prisma.client.character.findUniqueOrThrow({
        where: { id: characterId },
        include: {
          items: {
            where: {
              location: { in: [ItemLocation.CHEST, ItemLocation.BACKPACK] },
            },
            orderBy: { createdAt: 'desc' },
          },
          equipment: { include: { item: true } },
          talents: true,
        },
      }),
      this.prisma.client.temperingJob.findMany({
        where: { characterId, activeItemId: { not: null } },
        select: { activeItemId: true },
      }),
    ]);
    const lockedItemIds = new Set(
      activeTempering.flatMap((job) =>
        job.activeItemId ? [job.activeItemId] : [],
      ),
    );
    const temperedEquipment = character.equipment.map((assignment) => ({
      ...assignment,
      item: withTemperedStats(assignment.item),
    }));
    const equipped = temperedEquipment.map((assignment) => ({
      slot: assignment.slot,
      item: this.itemModel(
        assignment.item,
        lockedItemIds.has(assignment.item.id),
      ),
    }));
    const mainHand = character.equipment.find(
      (entry) => entry.slot === EquipmentSlot.MAIN_HAND,
    )?.item;
    const ranks = Object.fromEntries(
      character.talents.map((talent) => [talent.type, talent.rank]),
    );
    const trained = talentBonuses({
      vitality: ranks[TalentType.VITALITY] ?? 0,
      power: ranks[TalentType.POWER] ?? 0,
      resilience: ranks[TalentType.RESILIENCE] ?? 0,
    });
    const awakened = {
      health: (ranks[TalentType.AWAKENED_VITALITY] ?? 0) * 30,
      damage: (ranks[TalentType.AWAKENED_POWER] ?? 0) * 8,
      armor: (ranks[TalentType.AWAKENED_RESILIENCE] ?? 0) * 6,
    };
    const level = levelBonuses(character.level);
    const equipmentStats = sumEquipmentWithSetBonuses(
      temperedEquipment.map((assignment) => assignment.item),
    );
    const activeSetBonuses = activeEquipmentSetBonuses(
      temperedEquipment.map((assignment) => assignment.item),
    );
    const setBonusProgress = equipmentSetBonusProgress(
      temperedEquipment.map((assignment) => assignment.item),
      character.items.map((item) => item.setId),
    );
    const baseDamage =
      BASE_DAMAGE[character.archetype] +
      level.damage +
      trained.damage +
      awakened.damage;
    const baseArmor =
      BASE_ARMOR[character.archetype] +
      level.armor +
      trained.armor +
      awakened.armor;
    const baseHealth =
      BASE_HEALTH[character.archetype] +
      level.health +
      trained.health +
      awakened.health;
    return {
      characterVersion: character.version,
      baseDamage,
      totalDamage: baseDamage + equipmentStats.damage,
      baseArmor,
      totalArmor: baseArmor + equipmentStats.armor,
      baseHealth,
      totalHealth: baseHealth + equipmentStats.health,
      chest: character.items
        .filter((item) => item.location === ItemLocation.CHEST)
        .map((item) => this.itemModel(item, lockedItemIds.has(item.id))),
      backpack: character.items
        .filter((item) => item.location === ItemLocation.BACKPACK)
        .map((item) => this.itemModel(item, lockedItemIds.has(item.id))),
      equipped,
      activeSetBonuses,
      setBonusProgress,
      mainHandVisualAssetId: mainHand?.visualAssetId ?? null,
    };
  }

  private itemModel(
    item: {
      id: string;
      definitionId: string;
      itemLevel: number;
      rarity: string;
      rollQuality: number;
      damage: number;
      armor: number;
      health: number;
      setId: string;
      binding: string;
      visualAssetId: string;
      temperingStage: number;
      temperingProgress: number;
      temperingVersion: number;
    },
    temperingLocked = false,
  ): InventoryItemModel {
    const damageRange = itemDamageRange(
      item.itemLevel,
      item.rarity as EngineItemRarity,
    );
    return {
      ...withTemperedStats(item),
      damageMin: damageRange.min,
      damageMax: damageRange.max,
      compatibleSlots: equipmentSlotsForDefinition(item.definitionId),
      name: itemDefinition(item.definitionId)?.name ?? 'Невідомий предмет',
      setName: itemDefinition(item.definitionId)?.setName ?? item.setId,
      temperingLocked,
    };
  }
}

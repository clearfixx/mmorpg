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
import { InventoryItemModel, InventoryModel } from './models/inventory.model';

const BASE_DAMAGE = {
  [CharacterArchetype.VANGUARD]: 16,
  [CharacterArchetype.RANGER]: 19,
  [CharacterArchetype.ARCANIST]: 21,
};

const ITEM_DEFINITIONS: Record<
  string,
  { name: string; equipmentSlots: readonly EquipmentSlot[] }
> = {
  'veteran-notched-blade-v1': {
    name: 'Зазубрений клинок Ветерана',
    equipmentSlots: [EquipmentSlot.MAIN_HAND],
  },
  'veteran-ashwood-bow-v1': {
    name: 'Ясеневий лук Ветерана',
    equipmentSlots: [EquipmentSlot.MAIN_HAND],
  },
  'veteran-cracked-focus-v1': {
    name: 'Тріснутий фокус Ветерана',
    equipmentSlots: [EquipmentSlot.MAIN_HAND],
  },
};

export function isEquipmentSlotCompatible(
  definitionId: string,
  slot: EquipmentSlot,
): boolean {
  return ITEM_DEFINITIONS[definitionId]?.equipmentSlots.includes(slot) ?? false;
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

  private async read(characterId: string): Promise<InventoryModel> {
    const character = await this.prisma.client.character.findUniqueOrThrow({
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
    });
    const equipped = character.equipment.map((assignment) => ({
      slot: assignment.slot,
      item: this.itemModel(assignment.item),
    }));
    const mainHand = character.equipment.find(
      (entry) => entry.slot === EquipmentSlot.MAIN_HAND,
    )?.item;
    const powerRank =
      character.talents.find((talent) => talent.type === TalentType.POWER)
        ?.rank ?? 0;
    const awakenedPowerRank =
      character.talents.find(
        (talent) => talent.type === TalentType.AWAKENED_POWER,
      )?.rank ?? 0;
    const baseDamage =
      BASE_DAMAGE[character.archetype] +
      levelBonuses(character.level).damage +
      talentBonuses({ vitality: 0, power: powerRank, resilience: 0 }).damage +
      awakenedPowerRank * 8;
    return {
      characterVersion: character.version,
      baseDamage,
      totalDamage: baseDamage + (mainHand?.damage ?? 0),
      chest: character.items
        .filter((item) => item.location === ItemLocation.CHEST)
        .map((item) => this.itemModel(item)),
      backpack: character.items
        .filter((item) => item.location === ItemLocation.BACKPACK)
        .map((item) => this.itemModel(item)),
      equipped,
      mainHandVisualAssetId: mainHand?.visualAssetId ?? null,
    };
  }

  private itemModel(item: {
    id: string;
    definitionId: string;
    itemLevel: number;
    rarity: string;
    rollQuality: number;
    damage: number;
    binding: string;
    setId: string;
    visualAssetId: string;
  }): InventoryItemModel {
    const damageRange = itemDamageRange(
      item.itemLevel,
      item.rarity as EngineItemRarity,
    );
    return {
      ...item,
      damageMin: damageRange.min,
      damageMax: damageRange.max,
      name: ITEM_DEFINITIONS[item.definitionId]?.name ?? 'Невідомий предмет',
      setName: item.setId === 'veteran' ? 'Ветеран' : item.setId,
    };
  }
}

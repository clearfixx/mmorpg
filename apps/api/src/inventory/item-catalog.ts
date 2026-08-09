import { CharacterArchetype, EquipmentSlot } from '@veilfall/database';

export interface ItemDefinition {
  definitionId: string;
  name: string;
  visualAssetId: string;
  setId: string;
  setName: string;
  equipmentSlots: readonly EquipmentSlot[];
  statWeights: { damage: number; armor: number; health: number };
}

const STARTER_WEAPONS: Record<CharacterArchetype, ItemDefinition> = {
  [CharacterArchetype.VANGUARD]: definition(
    'veteran-notched-blade-v1',
    'Зазубрений клинок Ветерана',
    'weapon-veteran-blade-01',
    [EquipmentSlot.MAIN_HAND],
    100,
    0,
    0,
  ),
  [CharacterArchetype.RANGER]: definition(
    'veteran-ashwood-bow-v1',
    'Ясеневий лук Ветерана',
    'weapon-veteran-bow-01',
    [EquipmentSlot.MAIN_HAND],
    100,
    0,
    0,
  ),
  [CharacterArchetype.ARCANIST]: definition(
    'veteran-cracked-focus-v1',
    'Тріснутий фокус Ветерана',
    'weapon-veteran-focus-01',
    [EquipmentSlot.MAIN_HAND],
    100,
    0,
    0,
  ),
};

const VETERAN_GEAR = [
  definition(
    'veteran-helm-v1',
    'Шолом Ветерана',
    'armor-veteran-helm-01',
    [EquipmentSlot.HEAD],
    0,
    55,
    180,
  ),
  definition(
    'veteran-pauldrons-v1',
    'Наплічники Ветерана',
    'armor-veteran-shoulders-01',
    [EquipmentSlot.SHOULDERS],
    0,
    45,
    150,
  ),
  definition(
    'veteran-breastplate-v1',
    'Нагрудник Ветерана',
    'armor-veteran-chest-01',
    [EquipmentSlot.CHEST],
    0,
    80,
    320,
  ),
  definition(
    'veteran-bracers-v1',
    'Наручі Ветерана',
    'armor-veteran-bracers-01',
    [EquipmentSlot.BRACERS],
    0,
    35,
    110,
  ),
  definition(
    'veteran-gloves-v1',
    'Рукавиці Ветерана',
    'armor-veteran-gloves-01',
    [EquipmentSlot.HANDS],
    15,
    25,
    80,
  ),
  definition(
    'veteran-belt-v1',
    'Пояс Ветерана',
    'armor-veteran-belt-01',
    [EquipmentSlot.WAIST],
    0,
    30,
    130,
  ),
  definition(
    'veteran-greaves-v1',
    'Штани Ветерана',
    'armor-veteran-legs-01',
    [EquipmentSlot.LEGS],
    0,
    65,
    250,
  ),
  definition(
    'veteran-boots-v1',
    'Черевики Ветерана',
    'armor-veteran-boots-01',
    [EquipmentSlot.FEET],
    0,
    40,
    100,
  ),
  definition(
    'veteran-guard-v1',
    'Щит Ветерана',
    'offhand-veteran-guard-01',
    [EquipmentSlot.OFF_HAND],
    15,
    70,
    120,
  ),
  definition(
    'veteran-amulet-v1',
    'Амулет Ветерана',
    'jewel-veteran-amulet-01',
    [EquipmentSlot.AMULET],
    25,
    10,
    160,
  ),
  definition(
    'veteran-bracelet-v1',
    'Браслет Ветерана',
    'jewel-veteran-bracelet-01',
    [EquipmentSlot.BRACELET],
    20,
    15,
    100,
  ),
  definition(
    'veteran-ring-v1',
    'Каблучка Ветерана',
    'jewel-veteran-ring-01',
    [EquipmentSlot.RING_LEFT, EquipmentSlot.RING_RIGHT],
    30,
    10,
    70,
  ),
] as const;

const ITEM_DEFINITIONS = new Map<string, ItemDefinition>(
  [...Object.values(STARTER_WEAPONS), ...VETERAN_GEAR].map((item) => [
    item.definitionId,
    item,
  ]),
);

function definition(
  definitionId: string,
  name: string,
  visualAssetId: string,
  equipmentSlots: readonly EquipmentSlot[],
  damage: number,
  armor: number,
  health: number,
): ItemDefinition {
  return {
    definitionId,
    name,
    visualAssetId,
    equipmentSlots,
    statWeights: { damage, armor, health },
    setId: 'veteran',
    setName: 'Ветеран',
  };
}

export function itemDefinition(definitionId: string): ItemDefinition | null {
  return ITEM_DEFINITIONS.get(definitionId) ?? null;
}

export function rewardDefinitionFor(
  archetype: CharacterArchetype,
  encounterTier: number,
): ItemDefinition {
  const tier = Math.max(1, Math.floor(encounterTier));
  if (tier === 1) return STARTER_WEAPONS[archetype];
  return VETERAN_GEAR[(tier - 2) % VETERAN_GEAR.length];
}

export function itemStatsForPower(
  power: number,
  weights: ItemDefinition['statWeights'],
): { damage: number; armor: number; health: number } {
  const value = Math.max(1, Math.floor(power));
  return {
    damage: scale(value, weights.damage),
    armor: scale(value, weights.armor),
    health: scale(value, weights.health),
  };
}

function scale(value: number, percent: number): number {
  return percent === 0 ? 0 : Math.max(1, Math.round((value * percent) / 100));
}

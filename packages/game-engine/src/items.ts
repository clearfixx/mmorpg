export const MIN_ITEM_LEVEL = 1
export const MAX_ITEM_LEVEL = 99
export const MIN_ROLL_QUALITY = 0
export const MAX_ROLL_QUALITY = 9_999

export const ITEM_RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
  'MYTHIC',
  'DIVINE',
] as const

export type ItemRarity = (typeof ITEM_RARITIES)[number]

const RARITY_MULTIPLIER_PERCENT: Record<ItemRarity, number> = {
  COMMON: 100,
  UNCOMMON: 125,
  RARE: 165,
  EPIC: 220,
  LEGENDARY: 300,
  MYTHIC: 420,
  DIVINE: 600,
}

const RARITY_ROLL_THRESHOLD: ReadonlyArray<{
  rarity: ItemRarity
  threshold: number
}> = [
  { rarity: 'DIVINE', threshold: 1 },
  { rarity: 'MYTHIC', threshold: 10 },
  { rarity: 'LEGENDARY', threshold: 50 },
  { rarity: 'EPIC', threshold: 200 },
  { rarity: 'RARE', threshold: 700 },
  { rarity: 'UNCOMMON', threshold: 3_000 },
]

export interface ItemStatRange {
  min: number
  max: number
}

export interface ItemPowerRoll extends ItemStatRange {
  itemLevel: number
  rarity: ItemRarity
  rollQuality: number
  value: number
}

export interface EquipmentStats {
  damage: number
  armor: number
  health: number
}

export interface EquipmentSetItem extends Partial<EquipmentStats> {
  setId?: string | null
}

export interface ActiveSetBonus extends EquipmentStats {
  setId: string
  setName: string
  equippedPieces: number
  requiredPieces: number
  name: string
}

export interface EquipmentSetBonusProgress extends ActiveSetBonus {
  active: boolean
}

interface SetBonusDefinition extends EquipmentStats {
  requiredPieces: number
  name: string
}

const EQUIPMENT_SET_BONUSES: Record<
  string,
  { name: string; bonuses: readonly SetBonusDefinition[] }
> = {
  veteran: {
    name: 'Ветеран',
    bonuses: [
      {
        requiredPieces: 2,
        name: 'Загартована пара',
        damage: 0,
        armor: 8,
        health: 0,
      },
      {
        requiredPieces: 4,
        name: 'Похідний стрій',
        damage: 0,
        armor: 0,
        health: 45,
      },
      {
        requiredPieces: 6,
        name: 'Досвід фронту',
        damage: 10,
        armor: 0,
        health: 0,
      },
      {
        requiredPieces: 8,
        name: 'Незламний ветеран',
        damage: 8,
        armor: 12,
        health: 35,
      },
    ],
  },
  'veil-warden': {
    name: 'Вартовий Завіси',
    bonuses: [
      {
        requiredPieces: 1,
        name: 'Відлуння розлому',
        damage: 12,
        armor: 10,
        health: 50,
      },
    ],
  },
}

export function equipmentSetBonusProgress(
  items: ReadonlyArray<EquipmentSetItem>,
  additionalSetIds: ReadonlyArray<string> = [],
): EquipmentSetBonusProgress[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.setId) continue
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1)
  }
  for (const setId of additionalSetIds) {
    if (!counts.has(setId)) counts.set(setId, 0)
  }

  return Array.from(counts.entries()).flatMap(([setId, equippedPieces]) => {
    const definition = EQUIPMENT_SET_BONUSES[setId]
    if (!definition) return []
    return definition.bonuses.map((bonus) => ({
      setId,
      setName: definition.name,
      equippedPieces,
      active: equippedPieces >= bonus.requiredPieces,
      ...bonus,
    }))
  })
}

export function sumEquipmentStats(
  items: ReadonlyArray<Partial<EquipmentStats>>,
): EquipmentStats {
  return items.reduce<EquipmentStats>(
    (total, item) => ({
      damage: total.damage + (item.damage ?? 0),
      armor: total.armor + (item.armor ?? 0),
      health: total.health + (item.health ?? 0),
    }),
    { damage: 0, armor: 0, health: 0 },
  )
}

export function activeEquipmentSetBonuses(
  items: ReadonlyArray<EquipmentSetItem>,
): ActiveSetBonus[] {
  return equipmentSetBonusProgress(items)
    .filter((bonus) => bonus.active)
    .map(({ active: _active, ...bonus }) => bonus)
}

export function sumEquipmentWithSetBonuses(
  items: ReadonlyArray<EquipmentSetItem>,
): EquipmentStats {
  return sumEquipmentStats([...items, ...activeEquipmentSetBonuses(items)])
}

export function clampItemLevel(level: number): number {
  return Math.min(MAX_ITEM_LEVEL, Math.max(MIN_ITEM_LEVEL, Math.floor(level)))
}

export function clampRollQuality(quality: number): number {
  return Math.min(
    MAX_ROLL_QUALITY,
    Math.max(MIN_ROLL_QUALITY, Math.floor(quality)),
  )
}

export function itemDamageRange(
  itemLevel: number,
  rarity: ItemRarity,
): ItemStatRange {
  const level = clampItemLevel(itemLevel)
  const commonMinimum = 10 + Math.floor(((level - 1) * 213) / 98)
  const min = Math.ceil(
    (commonMinimum * RARITY_MULTIPLIER_PERCENT[rarity]) / 100,
  )
  return { min, max: Math.ceil((min * 115) / 100) }
}

export function rollItemPower(
  itemLevel: number,
  rarity: ItemRarity,
  rollQuality: number,
): ItemPowerRoll {
  const level = clampItemLevel(itemLevel)
  const quality = clampRollQuality(rollQuality)
  const range = itemDamageRange(level, rarity)
  const value =
    range.min +
    Math.floor(
      ((range.max - range.min) * quality) / Math.max(1, MAX_ROLL_QUALITY),
    )
  return {
    itemLevel: level,
    rarity,
    rollQuality: quality,
    value,
    ...range,
  }
}

export function maxRarityForEncounterTier(tier: number): ItemRarity {
  const safeTier = Math.max(1, Math.floor(tier))
  if (safeTier >= 5) return 'MYTHIC'
  if (safeTier === 4) return 'LEGENDARY'
  if (safeTier === 3) return 'EPIC'
  if (safeTier === 2) return 'RARE'
  return 'UNCOMMON'
}

export function rarityForRoll(
  roll: number,
  maximumRarity: ItemRarity,
): ItemRarity {
  const normalizedRoll = ((Math.floor(roll) % 10_000) + 10_000) % 10_000
  const maximumIndex = ITEM_RARITIES.indexOf(maximumRarity)
  for (const candidate of RARITY_ROLL_THRESHOLD) {
    if (normalizedRoll >= candidate.threshold) continue
    const candidateIndex = ITEM_RARITIES.indexOf(candidate.rarity)
    return ITEM_RARITIES[Math.min(candidateIndex, maximumIndex)]!
  }
  return 'COMMON'
}

export function itemLevelForReward(
  characterLevel: number,
  encounterTier: number,
): number {
  return clampItemLevel(characterLevel + Math.max(0, encounterTier - 1))
}

export function equipmentDropChancePercent(encounterTier: number): number {
  const tier = Math.max(1, Math.floor(encounterTier))
  if (tier <= 2 || tier % 5 === 0) return 100
  return Math.min(45, 28 + Math.floor(tier / 10) * 2)
}

export function shouldDropEquipment(
  encounterTier: number,
  roll: number,
): boolean {
  const normalizedRoll = ((Math.floor(roll) % 10_000) + 10_000) % 10_000
  return normalizedRoll < equipmentDropChancePercent(encounterTier) * 100
}

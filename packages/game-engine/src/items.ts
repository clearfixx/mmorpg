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

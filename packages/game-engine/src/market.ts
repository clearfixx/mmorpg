import type { ItemRarity } from './items'
import { resourceDefinition, type ResourceType } from './resources'

const RARITY_PRICE_MULTIPLIER: Record<ItemRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 4,
  EPIC: 8,
  LEGENDARY: 16,
  MYTHIC: 32,
  DIVINE: 64,
}

export function minimumEquipmentMarketPrice(
  itemLevel: number,
  rarity: ItemRarity,
): number {
  return Math.max(
    1,
    Math.ceil(
      (Math.max(1, Math.min(99, Math.floor(itemLevel))) *
        RARITY_PRICE_MULTIPLIER[rarity]) /
        10,
    ),
  )
}

export function minimumResourceMarketPrice(
  type: ResourceType,
  amount: number,
): number {
  const resource = resourceDefinition(type)
  const rarity = RARITY_PRICE_MULTIPLIER[resource.rarity]
  const origin =
    resource.origin === 'BOSS_EXCLUSIVE'
      ? 4
      : resource.origin === 'CRAFTED'
        ? 2
        : 1
  return Math.max(
    1,
    Math.ceil((Math.max(1, Math.floor(amount)) * rarity * origin) / 8),
  )
}

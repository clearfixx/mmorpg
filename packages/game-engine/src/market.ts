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

export const MARKET_SALE_FEE_PERCENT = 5

export function marketSaleFee(price: number): number {
  const normalized = Math.max(1, Math.floor(price))
  return Math.max(1, Math.ceil((normalized * MARKET_SALE_FEE_PERCENT) / 100))
}

export function marketSellerProceeds(price: number): number {
  const normalized = Math.max(1, Math.floor(price))
  return Math.max(0, normalized - marketSaleFee(normalized))
}

export function medianMarketPrice(prices: number[]): number | null {
  const normalized = prices
    .map((price) => Math.max(1, Math.floor(price)))
    .sort((left, right) => left - right)
  if (normalized.length === 0) return null
  const middle = Math.floor(normalized.length / 2)
  if (normalized.length % 2 === 1) return normalized[middle]!
  return Math.ceil((normalized[middle - 1]! + normalized[middle]!) / 2)
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

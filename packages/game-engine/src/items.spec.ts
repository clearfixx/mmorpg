import { describe, expect, it } from 'vitest'

import {
  ITEM_RARITIES,
  itemDamageRange,
  itemLevelForReward,
  maxRarityForEncounterTier,
  rarityForRoll,
  rollItemPower,
  sumEquipmentStats,
} from './items'

describe('item power', () => {
  it('defines the level-one and level-99 boundaries', () => {
    expect(itemDamageRange(1, 'COMMON')).toEqual({ min: 10, max: 12 })
    expect(itemDamageRange(99, 'COMMON')).toEqual({ min: 223, max: 257 })
    expect(itemDamageRange(99, 'MYTHIC')).toEqual({
      min: 937,
      max: 1_078,
    })
  })

  it('never overlaps adjacent rarities at the same level', () => {
    for (let level = 1; level <= 99; level += 1) {
      for (let index = 1; index < ITEM_RARITIES.length; index += 1) {
        const previous = itemDamageRange(level, ITEM_RARITIES[index - 1]!)
        const current = itemDamageRange(level, ITEM_RARITIES[index]!)
        expect(current.min).toBeGreaterThan(previous.max)
      }
    }
  })

  it('maps deterministic quality to the complete allowed range', () => {
    expect(rollItemPower(1, 'COMMON', 0).value).toBe(10)
    expect(rollItemPower(1, 'COMMON', 9_999).value).toBe(12)
    expect(rollItemPower(120, 'MYTHIC', 50_000)).toMatchObject({
      itemLevel: 99,
      rollQuality: 9_999,
      value: 1_078,
    })
  })

  it('caps ordinary encounter rarity before divine equipment', () => {
    expect(maxRarityForEncounterTier(1)).toBe('UNCOMMON')
    expect(maxRarityForEncounterTier(2)).toBe('RARE')
    expect(maxRarityForEncounterTier(5)).toBe('MYTHIC')
    expect(maxRarityForEncounterTier(100)).toBe('MYTHIC')
    expect(rarityForRoll(0, 'UNCOMMON')).toBe('UNCOMMON')
    expect(rarityForRoll(0, 'MYTHIC')).toBe('MYTHIC')
    expect(rarityForRoll(9_999, 'MYTHIC')).toBe('COMMON')
  })

  it('uses encounter depth without exceeding the item cap', () => {
    expect(itemLevelForReward(1, 1)).toBe(1)
    expect(itemLevelForReward(1, 2)).toBe(2)
    expect(itemLevelForReward(98, 5)).toBe(99)
  })

  it('sums every equipped item stat and accepts legacy partial items', () => {
    expect(
      sumEquipmentStats([
        { damage: 12 },
        { armor: 8, health: 25 },
        { damage: 3, armor: 2 },
      ]),
    ).toEqual({ damage: 15, armor: 10, health: 25 })
  })
})

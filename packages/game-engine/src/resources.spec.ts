import { describe, expect, it } from 'vitest'

import {
  RESOURCE_DEFINITIONS,
  RESOURCE_TYPES,
  resourceDefinition,
} from './resources'

describe('resource catalog', () => {
  it('defines every resource exactly once', () => {
    expect(Object.keys(RESOURCE_DEFINITIONS).sort()).toEqual(
      [...RESOURCE_TYPES].sort(),
    )
  })

  it('keeps crafted and boss-exclusive resources out of ordinary drops', () => {
    expect(resourceDefinition('VEIL_STEEL')).toMatchObject({
      origin: 'CRAFTED',
      clanContributable: false,
    })
    expect(resourceDefinition('CURSED_HEART')).toMatchObject({
      origin: 'BOSS_EXCLUSIVE',
      rarity: 'MYTHIC',
      clanContributable: false,
    })
    expect(resourceDefinition('BOSS_INVOCATION_SEAL')).toMatchObject({
      origin: 'BOSS_EXCLUSIVE',
      rarity: 'LEGENDARY',
      tradeable: true,
    })
    expect(resourceDefinition('DARK_PRIEST_INVOCATION_SEAL')).toMatchObject({
      origin: 'CRAFTED',
      rarity: 'LEGENDARY',
      tradeable: true,
    })
  })

  it('allows the current clan progression resources explicitly', () => {
    for (const type of ['IRON', 'COPPER', 'BRONZE', 'VEIL_ECHO'] as const) {
      expect(resourceDefinition(type).clanContributable).toBe(true)
      expect(resourceDefinition(type).clanContributionWeight).toBeGreaterThan(0)
    }
  })
})

import { describe, expect, it } from 'vitest'

import {
  CINDERHAVEN_UNLOCK_TIER,
  canUnlockCinderhaven,
  dryadForestResourceDrops,
  hollowRoadResourceDrops,
} from './world'

describe('world progression', () => {
  it('unlocks Cinderhaven only after the fiftieth Hollow Road tier', () => {
    expect(CINDERHAVEN_UNLOCK_TIER).toBe(50)
    expect(canUnlockCinderhaven(49)).toBe(false)
    expect(canUnlockCinderhaven(50)).toBe(true)
  })

  it('rolls each regional material independently and caps it at one', () => {
    expect(hollowRoadResourceDrops([34, 24, 14, 7])).toEqual([
      { type: 'IRON', amount: 1 },
      { type: 'COAL', amount: 1 },
      { type: 'LEATHER', amount: 1 },
      { type: 'WEAPON_FRAGMENT', amount: 1 },
    ])
    expect(hollowRoadResourceDrops([35, 25, 15, 8])).toEqual([])
  })

  it('uses a distinct resource family in the Dryad Forest', () => {
    expect(dryadForestResourceDrops([0, 0, 0, 0])).toEqual([
      { type: 'TIMBER', amount: 1 },
      { type: 'HERBS', amount: 1 },
      { type: 'LEATHER', amount: 1 },
      { type: 'OBSIDIAN_SHARD', amount: 1 },
    ])
  })
})

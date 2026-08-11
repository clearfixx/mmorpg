import { describe, expect, it } from 'vitest'

import {
  minimumEquipmentMarketPrice,
  minimumResourceMarketPrice,
} from './market'

describe('market price floors', () => {
  it('makes high-level divine equipment materially more expensive', () => {
    expect(minimumEquipmentMarketPrice(99, 'DIVINE')).toBe(634)
    expect(minimumEquipmentMarketPrice(1, 'COMMON')).toBe(1)
  })

  it('prices boss-exclusive lots above ordinary resources', () => {
    expect(minimumResourceMarketPrice('CURSED_HEART', 1)).toBeGreaterThan(
      minimumResourceMarketPrice('IRON', 1),
    )
  })
})

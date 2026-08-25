import { describe, expect, it } from 'vitest'

import {
  marketSaleFee,
  marketSellerProceeds,
  medianMarketPrice,
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

  it('removes a five-percent fee from successful sales', () => {
    expect(marketSaleFee(100)).toBe(5)
    expect(marketSaleFee(9)).toBe(1)
    expect(marketSellerProceeds(100)).toBe(95)
    expect(marketSellerProceeds(9)).toBe(8)
  })

  it('calculates a stable median from completed sales', () => {
    expect(medianMarketPrice([])).toBeNull()
    expect(medianMarketPrice([30, 10, 20])).toBe(20)
    expect(medianMarketPrice([10, 20])).toBe(15)
  })
})

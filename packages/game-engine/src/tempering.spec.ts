import { describe, expect, it } from 'vitest'

import {
  MAX_TEMPERING_STAGE,
  TEMPERING_STAGES,
  acceleratedDurationSeconds,
  resolveTempering,
  temperedStats,
  temperingCancellationRefund,
  temperingEligibility,
  temperingStage,
} from './tempering'

describe('endgame tempering', () => {
  it('defines fifteen increasingly expensive long-running stages', () => {
    expect(TEMPERING_STAGES).toHaveLength(MAX_TEMPERING_STAGE)
    for (let index = 1; index < TEMPERING_STAGES.length; index += 1) {
      expect(TEMPERING_STAGES[index]!.durationSeconds).toBeGreaterThan(
        TEMPERING_STAGES[index - 1]!.durationSeconds,
      )
      expect(TEMPERING_STAGES[index]!.gold).toBeGreaterThan(
        TEMPERING_STAGES[index - 1]!.gold,
      )
    }
    expect(temperingStage(15)).toMatchObject({
      durationSeconds: 180 * 24 * 60 * 60,
      successChanceBasisPoints: 10_000,
      accelerationLimitPercent: 0,
      ritualMilestone: true,
    })
  })

  it('limits access to bound endgame legendary equipment', () => {
    expect(
      temperingEligibility({
        heroLevel: 60,
        itemLevel: 50,
        rarity: 'LEGENDARY',
        binding: 'BOUND',
        currentStage: 0,
      }),
    ).toEqual({ eligible: true, reasons: [] })
    expect(
      temperingEligibility({
        heroLevel: 30,
        itemLevel: 20,
        rarity: 'EPIC',
        binding: 'UNBOUND',
        currentStage: 15,
      }),
    ).toMatchObject({ eligible: false })
  })

  it('makes early stages certain and converts later failure into progress', () => {
    expect(
      resolveTempering({
        currentStage: 0,
        progressBasisPoints: 0,
        roll: 9_999,
      }),
    ).toMatchObject({ outcome: 'SUCCESS', nextStage: 1 })
    expect(
      resolveTempering({
        currentStage: 9,
        progressBasisPoints: 0,
        roll: 9_999,
      }),
    ).toEqual({
      outcome: 'PROGRESS',
      nextStage: 9,
      nextProgressBasisPoints: 1_700,
      guaranteed: false,
    })
  })

  it('guarantees advancement after the progress meter is filled', () => {
    expect(
      resolveTempering({
        currentStage: 13,
        progressBasisPoints: 10_000,
        roll: 9_999,
      }),
    ).toEqual({
      outcome: 'SUCCESS',
      nextStage: 14,
      nextProgressBasisPoints: 0,
      guaranteed: true,
    })
  })

  it('scales only stats already present on the item', () => {
    expect(temperedStats({ damage: 100, armor: 0, health: 20 }, 15)).toEqual({
      damage: 235,
      armor: 0,
      health: 47,
    })
  })

  it('caps acceleration and never accelerates the final ritual', () => {
    expect(acceleratedDurationSeconds(10, 100)).toBe(
      Math.ceil(temperingStage(10)!.durationSeconds * 0.65),
    )
    expect(acceleratedDurationSeconds(15, 35)).toBe(
      temperingStage(15)!.durationSeconds,
    )
  })

  it('refunds only forty percent of mundane refundable inputs', () => {
    expect(temperingCancellationRefund(6)).toEqual([
      expect.objectContaining({ resourceType: 'VEIL_STEEL', amount: 57 }),
    ])
  })
})

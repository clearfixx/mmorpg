import { describe, expect, it } from 'vitest'

import {
  temperingCancellationPreview,
  temperingInvestmentSummary,
  temperingRoadmap,
  temperingStageExpectation,
} from './tempering-roadmap'
import {
  completeTemperingProcess,
  startTemperingProcess,
} from './tempering-process'

describe('tempering long-term roadmap', () => {
  it('models certain stages as exactly one attempt', () => {
    expect(temperingStageExpectation(1)).toMatchObject({
      expectedAttempts: 1,
      maximumAttempts: 1,
      expectedDurationSeconds: 43_200,
    })
    expect(temperingStageExpectation(15, 35)).toMatchObject({
      expectedAttempts: 1,
      maximumAttempts: 1,
      expectedDurationSeconds: 15_552_000,
    })
  })

  it('bounds a risky stage by its pity guarantee', () => {
    const stage = temperingStageExpectation(10)
    expect(stage.expectedAttempts).toBeGreaterThan(1)
    expect(stage.expectedAttempts).toBeLessThan(stage.maximumAttempts)
    expect(stage.maximumAttempts).toBe(7)
  })

  it('builds a complete expensive journey to the named final temper', () => {
    const roadmap = temperingRoadmap({ fromStage: 0 })
    expect(roadmap.stages).toHaveLength(15)
    expect(roadmap.toStage).toBe(15)
    expect(roadmap.expectedAttempts).toBeGreaterThan(15)
    expect(roadmap.maximumAttempts).toBeGreaterThan(roadmap.expectedAttempts)
    expect(roadmap.expectedCost.gold).toBeGreaterThan(50_000_000)
    expect(roadmap.expectedCost.resources.VEIL_STEEL).toBeGreaterThan(10_000)
    expect(roadmap.expectedDurationSeconds).toBeGreaterThan(365 * 86_400)
  })

  it('compares accelerated and normal scenarios without accelerating stage XV', () => {
    const normal = temperingRoadmap({ fromStage: 12 })
    const accelerated = temperingRoadmap({
      fromStage: 12,
      accelerationPercent: 35,
    })
    expect(accelerated.expectedDurationSeconds).toBeLessThan(
      normal.expectedDurationSeconds,
    )
    expect(accelerated.expectedCost.resources.VEIL_ECHO).toBeGreaterThan(
      normal.expectedCost.resources.VEIL_ECHO!,
    )
    expect(accelerated.stages.at(-1)!.expectedDurationSeconds).toBe(
      normal.stages.at(-1)!.expectedDurationSeconds,
    )
  })

  it('summarizes only resolved historical investment', () => {
    const started = startTemperingProcess({
      id: 'attempt-1',
      itemId: 'item-1',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const completed = completeTemperingProcess(started, {
      now: started.readyAt,
      roll: 0,
    })
    expect(temperingInvestmentSummary([completed, started])).toMatchObject({
      completedAttempts: 1,
      successfulAttempts: 1,
      progressAttempts: 0,
      elapsedSeconds: 43_200,
      goldSpent: 25_000,
      stonesSpent: { DULL: 1 },
    })
  })

  it('shows exact returned and destroyed assets before cancellation', () => {
    const started = startTemperingProcess({
      id: 'attempt-2',
      itemId: 'item-2',
      currentStage: 5,
      progressBasisPoints: 0,
      accelerationPercent: 20,
      startedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const preview = temperingCancellationPreview(
      started,
      new Date(
        started.startedAt.getTime() +
          (started.readyAt.getTime() - started.startedAt.getTime()) / 2,
      ),
    )
    expect(preview).toMatchObject({
      progressPercent: 50,
      returnedResources: { VEIL_STEEL: 57 },
      lostGold: 900_000,
      lostStones: { WHOLE: 2 },
    })
    expect(preview.lostResources.VEIL_ECHO).toBeGreaterThan(12)
  })
})

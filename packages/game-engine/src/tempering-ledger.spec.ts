import { describe, expect, it } from 'vitest'

import {
  applyTemperingLedger,
  assertTemperingQueueAvailable,
  projectActiveTempering,
  projectCompletedTempering,
  temperingAttemptRecord,
  temperingCancellationLedger,
  temperingStartLedger,
} from './tempering-ledger'
import {
  cancelTemperingProcess,
  completeTemperingProcess,
  quoteTempering,
  startTemperingProcess,
} from './tempering-process'

describe('tempering persistence rules', () => {
  it('builds and atomically applies the complete start payment', () => {
    const quote = quoteTempering({ currentStage: 0 })
    const entries = temperingStartLedger(quote)
    const wallet = applyTemperingLedger(
      {
        gold: 100_000,
        stones: { DULL: 2 },
        resources: {
          VEIL_STEEL: 10,
          STABILIZED_CATALYST: 10,
          VEIL_ECHO: 10,
        },
      },
      entries,
    )
    expect(wallet).toEqual({
      gold: 75_000,
      stones: { DULL: 1 },
      resources: {
        VEIL_STEEL: 6,
        STABILIZED_CATALYST: 9,
        VEIL_ECHO: 8,
      },
    })
  })

  it('does not mutate the source wallet when one debit cannot be paid', () => {
    const source = {
      gold: 25_000,
      stones: { DULL: 1 },
      resources: {
        VEIL_STEEL: 4,
        STABILIZED_CATALYST: 1,
        VEIL_ECHO: 1,
      },
    }
    const before = structuredClone(source)
    expect(() =>
      applyTemperingLedger(
        source,
        temperingStartLedger(quoteTempering({ currentStage: 0 })),
      ),
    ).toThrow('INSUFFICIENT_VEIL_ECHO')
    expect(source).toEqual(before)
  })

  it('locks an item and enforces a finite independent queue', () => {
    const active = startTemperingProcess({
      id: 'process-1',
      itemId: 'item-1',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt: new Date(),
    })
    expect(() =>
      assertTemperingQueueAvailable({
        itemId: 'item-1',
        activeProcesses: [active],
        activeProcessCount: 1,
        queueCapacity: 3,
      }),
    ).toThrow('ITEM_ALREADY_TEMPERING')
    expect(() =>
      assertTemperingQueueAvailable({
        itemId: 'item-2',
        activeProcesses: [active],
        activeProcessCount: 3,
        queueCapacity: 3,
      }),
    ).toThrow('TEMPERING_QUEUE_FULL')
  })

  it('projects active and completed item state without exposing mutable process data', () => {
    const process = startTemperingProcess({
      id: 'process-2',
      itemId: 'item-2',
      currentStage: 9,
      progressBasisPoints: 8_500,
      startedAt: new Date('2026-08-14T00:00:00Z'),
    })
    expect(projectActiveTempering(9, 8_500, process)).toEqual({
      stage: 9,
      progressBasisPoints: 8_500,
      activeProcessId: 'process-2',
      locked: true,
    })
    const completed = completeTemperingProcess(process, {
      now: process.readyAt,
      roll: 9_999,
    })
    expect(projectCompletedTempering(completed)).toEqual({
      stage: 9,
      progressBasisPoints: 10_000,
      activeProcessId: null,
      locked: false,
    })
  })

  it('creates an immutable audit record for every resolved attempt', () => {
    const process = startTemperingProcess({
      id: 'process-3',
      itemId: 'item-3',
      currentStage: 0,
      progressBasisPoints: 0,
      accelerationPercent: 10,
      startedAt: new Date('2026-08-14T00:00:00Z'),
    })
    const completed = completeTemperingProcess(process, {
      now: process.readyAt,
      roll: 9_999,
    })
    expect(temperingAttemptRecord(completed)).toMatchObject({
      processId: 'process-3',
      itemId: 'item-3',
      targetStage: 1,
      outcome: 'SUCCESS',
      resultingStage: 1,
      resultingProgressBasisPoints: 0,
      accelerationPercent: 10,
    })
  })

  it('turns only the allowed cancellation refund into credits', () => {
    const process = startTemperingProcess({
      id: 'process-4',
      itemId: 'item-4',
      currentStage: 5,
      progressBasisPoints: 0,
      startedAt: new Date(),
    })
    const { settlement } = cancelTemperingProcess(process, new Date())
    expect(temperingCancellationLedger(settlement)).toEqual([
      {
        direction: 'CREDIT',
        asset: 'RESOURCE',
        key: 'VEIL_STEEL',
        amount: 57,
        reason: 'CANCELLATION_REFUND',
      },
    ])
  })
})

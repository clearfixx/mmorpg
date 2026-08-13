import { describe, expect, it } from 'vitest'

import {
  cancelTemperingProcess,
  completeTemperingProcess,
  quoteTempering,
  startTemperingProcess,
  temperingAffordability,
  temperingProcessStatus,
} from './tempering-process'

describe('tempering process', () => {
  it('quotes one exact target stage and caps paid acceleration', () => {
    const quote = quoteTempering({ currentStage: 9, accelerationPercent: 90 })
    expect(quote).toMatchObject({
      targetStage: 10,
      accelerationPercent: 35,
      stoneGrade: 'MYTHIC',
      stoneAmount: 4,
    })
    expect(quote.accelerationResources).toEqual([
      expect.objectContaining({ resourceType: 'VEIL_ECHO', amount: 350 }),
      expect.objectContaining({
        resourceType: 'STABILIZED_CATALYST',
        amount: 70,
      }),
    ])
  })

  it('reports every missing payment without mutating the wallet', () => {
    const quote = quoteTempering({ currentStage: 3 })
    const wallet = { gold: 0, stones: {}, resources: {} }
    const before = structuredClone(wallet)
    expect(temperingAffordability(quote, wallet)).toEqual({
      affordable: false,
      missing: [
        'GOLD:400000',
        'WHOLE_STONE:2',
        'VEIL_STEEL:64',
        'STABILIZED_CATALYST:8',
        'VEIL_ECHO:8',
      ],
    })
    expect(wallet).toEqual(before)
  })

  it('starts an immutable timed process and becomes ready on its deadline', () => {
    const startedAt = new Date('2026-08-14T12:00:00.000Z')
    const process = startTemperingProcess({
      id: 'temper-1',
      itemId: 'item-1',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt,
    })
    expect(process.status).toBe('IN_PROGRESS')
    expect(
      temperingProcessStatus(process, new Date(process.readyAt.getTime() - 1)),
    ).toBe('IN_PROGRESS')
    expect(temperingProcessStatus(process, process.readyAt)).toBe('READY')
  })

  it('rejects early collection and resolves a mature process once', () => {
    const process = startTemperingProcess({
      id: 'temper-2',
      itemId: 'item-2',
      currentStage: 9,
      progressBasisPoints: 0,
      startedAt: new Date('2026-08-14T12:00:00.000Z'),
    })
    expect(() =>
      completeTemperingProcess(process, {
        now: new Date(process.readyAt.getTime() - 1),
        roll: 9_999,
      }),
    ).toThrow('TEMPERING_NOT_READY')
    const completed = completeTemperingProcess(process, {
      now: process.readyAt,
      roll: 9_999,
    })
    expect(completed).toMatchObject({
      status: 'PROGRESS_GAINED',
      resolution: { nextStage: 9, nextProgressBasisPoints: 1_700 },
    })
    expect(() =>
      completeTemperingProcess(completed, {
        now: process.readyAt,
        roll: 0,
      }),
    ).toThrow('TEMPERING_NOT_ACTIVE')
  })

  it('cancels only active work and burns gold, stones and rare inputs', () => {
    const process = startTemperingProcess({
      id: 'temper-3',
      itemId: 'item-3',
      currentStage: 5,
      progressBasisPoints: 3_000,
      accelerationPercent: 20,
      startedAt: new Date('2026-08-14T12:00:00.000Z'),
    })
    const cancelled = cancelTemperingProcess(
      process,
      new Date('2026-08-15T12:00:00.000Z'),
    )
    expect(cancelled.process.status).toBe('CANCELLED')
    expect(cancelled.settlement).toEqual({
      status: 'CANCELLED',
      resourceRefunds: [
        expect.objectContaining({ resourceType: 'VEIL_STEEL', amount: 57 }),
      ],
      goldRefund: 0,
      stoneRefund: 0,
    })
    expect(() => cancelTemperingProcess(cancelled.process, new Date())).toThrow(
      'TEMPERING_NOT_ACTIVE',
    )
  })

  it('forbids acceleration of the final named ritual', () => {
    const quote = quoteTempering({ currentStage: 14, accelerationPercent: 35 })
    expect(quote.accelerationPercent).toBe(0)
    expect(quote.accelerationResources).toEqual([])
  })
})

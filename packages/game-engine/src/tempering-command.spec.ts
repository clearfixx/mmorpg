import { describe, expect, it } from 'vitest'

import {
  assertTemperingVersions,
  resolveTemperingCommandReplay,
  temperingCommandHash,
  temperingCommandResult,
  temperingProcessView,
  temperingQueueView,
  type TemperingCommandEnvelope,
} from './tempering-command'
import {
  completeTemperingProcess,
  startTemperingProcess,
} from './tempering-process'

const command: TemperingCommandEnvelope = {
  characterId: 'character-1',
  idempotencyKey: 'temper-start-1',
  commandType: 'START',
  itemId: 'item-1',
  expectedCharacterVersion: 7,
  expectedItemVersion: 2,
  accelerationPercent: 20,
}

describe('tempering commands and public queue', () => {
  it('hashes all gameplay-relevant command fields deterministically', () => {
    expect(temperingCommandHash(command)).toHaveLength(64)
    expect(temperingCommandHash({ ...command })).toBe(
      temperingCommandHash(command),
    )
    expect(
      temperingCommandHash({ ...command, accelerationPercent: 21 }),
    ).not.toBe(temperingCommandHash(command))
  })

  it('replays an identical command and rejects key reuse', () => {
    const existing = {
      characterId: command.characterId,
      idempotencyKey: command.idempotencyKey,
      commandType: command.commandType,
      payloadHash: temperingCommandHash(command),
      resultReference: 'process-1',
    }
    expect(resolveTemperingCommandReplay({ command, existing })).toEqual({
      replay: true,
      resultReference: 'process-1',
    })
    expect(() =>
      resolveTemperingCommandReplay({
        command: { ...command, itemId: 'item-2' },
        existing,
      }),
    ).toThrow('IDEMPOTENCY_KEY_REUSED')
  })

  it('uses character and item versions as one optimistic concurrency boundary', () => {
    expect(
      assertTemperingVersions(
        { characterVersion: 7, itemVersion: 2 },
        { characterVersion: 7, itemVersion: 2 },
      ),
    ).toEqual({ characterVersion: 8, itemVersion: 3 })
    expect(() =>
      assertTemperingVersions(
        { characterVersion: 7, itemVersion: 2 },
        { characterVersion: 8, itemVersion: 2 },
      ),
    ).toThrow('TEMPERING_STATE_CHANGED')
  })

  it('returns a sorted queue with stable countdowns and capacity', () => {
    const now = new Date('2026-08-14T00:00:00Z')
    const later = startTemperingProcess({
      id: 'later',
      itemId: 'item-2',
      currentStage: 1,
      progressBasisPoints: 0,
      startedAt: now,
    })
    const earlier = startTemperingProcess({
      id: 'earlier',
      itemId: 'item-1',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt: now,
    })
    expect(
      temperingQueueView({ capacity: 3, processes: [later, earlier], now }),
    ).toMatchObject({
      capacity: 3,
      occupied: 2,
      available: 1,
      processes: [
        { id: 'earlier', remainingSeconds: 43_200 },
        { id: 'later', remainingSeconds: 86_400 },
      ],
    })
  })

  it('exposes ready collection separately from cancellable work', () => {
    const process = startTemperingProcess({
      id: 'process-2',
      itemId: 'item-2',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt: new Date('2026-08-14T00:00:00Z'),
    })
    expect(temperingProcessView(process, process.readyAt)).toMatchObject({
      status: 'READY',
      remainingSeconds: 0,
      canComplete: true,
      canCancel: false,
    })
  })

  it('builds a consistent command response after collection', () => {
    const process = startTemperingProcess({
      id: 'process-3',
      itemId: 'item-3',
      currentStage: 0,
      progressBasisPoints: 0,
      startedAt: new Date('2026-08-14T00:00:00Z'),
    })
    const completed = completeTemperingProcess(process, {
      now: process.readyAt,
      roll: 0,
    })
    expect(
      temperingCommandResult({
        commandType: 'COMPLETE',
        versions: { characterVersion: 8, itemVersion: 3 },
        process: completed,
        now: process.readyAt,
      }),
    ).toMatchObject({
      commandType: 'COMPLETE',
      characterVersion: 8,
      itemVersion: 3,
      process: { status: 'SUCCEEDED', canComplete: false, canCancel: false },
      quote: { targetStage: 1 },
    })
  })
})

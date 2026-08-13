import { createHash } from 'node:crypto'

import {
  temperingProcessStatus,
  type TemperingProcess,
  type TemperingProcessStatus,
  type TemperingQuote,
} from './tempering-process'

export type TemperingCommandType = 'START' | 'COMPLETE' | 'CANCEL'

export interface TemperingCommandEnvelope {
  characterId: string
  idempotencyKey: string
  commandType: TemperingCommandType
  itemId: string
  expectedCharacterVersion: number
  expectedItemVersion: number
  processId?: string
  accelerationPercent?: number
}

export interface TemperingCommandRecord {
  characterId: string
  idempotencyKey: string
  commandType: TemperingCommandType
  payloadHash: string
  resultReference: string
}

export interface TemperingVersionState {
  characterVersion: number
  itemVersion: number
}

export interface TemperingQueueProcessView {
  id: string
  itemId: string
  targetStage: number
  status: TemperingProcessStatus
  startedAt: Date
  readyAt: Date
  remainingSeconds: number
  accelerationPercent: number
  canComplete: boolean
  canCancel: boolean
}

export interface TemperingQueueView {
  capacity: number
  occupied: number
  available: number
  processes: readonly TemperingQueueProcessView[]
}

export interface TemperingCommandResult {
  commandType: TemperingCommandType
  characterVersion: number
  itemVersion: number
  process: TemperingQueueProcessView
  quote: TemperingQuote
}

export function temperingCommandHash(
  command: TemperingCommandEnvelope,
): string {
  return createHash('sha256')
    .update(
      [
        command.commandType,
        command.itemId,
        command.processId ?? '',
        command.expectedCharacterVersion,
        command.expectedItemVersion,
        Math.floor(command.accelerationPercent ?? 0),
      ].join(':'),
    )
    .digest('hex')
}

export function resolveTemperingCommandReplay(input: {
  command: TemperingCommandEnvelope
  existing: TemperingCommandRecord | null
}): { replay: false } | { replay: true; resultReference: string } {
  if (!input.existing) return { replay: false }
  if (
    input.existing.characterId !== input.command.characterId ||
    input.existing.commandType !== input.command.commandType ||
    input.existing.payloadHash !== temperingCommandHash(input.command)
  )
    throw new Error('IDEMPOTENCY_KEY_REUSED')
  return { replay: true, resultReference: input.existing.resultReference }
}

export function assertTemperingVersions(
  expected: TemperingVersionState,
  actual: TemperingVersionState,
): TemperingVersionState {
  if (
    expected.characterVersion !== actual.characterVersion ||
    expected.itemVersion !== actual.itemVersion
  )
    throw new Error('TEMPERING_STATE_CHANGED')
  return {
    characterVersion: actual.characterVersion + 1,
    itemVersion: actual.itemVersion + 1,
  }
}

export function temperingQueueView(input: {
  capacity: number
  processes: readonly TemperingProcess[]
  now: Date
}): TemperingQueueView {
  const active = input.processes
    .filter((process) => process.status === 'IN_PROGRESS')
    .sort((left, right) => left.readyAt.getTime() - right.readyAt.getTime())
    .map((process) => temperingProcessView(process, input.now))
  const capacity = Math.max(0, Math.floor(input.capacity))
  return {
    capacity,
    occupied: active.length,
    available: Math.max(0, capacity - active.length),
    processes: active,
  }
}

export function temperingProcessView(
  process: TemperingProcess,
  now: Date,
): TemperingQueueProcessView {
  const status = temperingProcessStatus(process, now)
  const active = process.status === 'IN_PROGRESS'
  return {
    id: process.id,
    itemId: process.itemId,
    targetStage: process.targetStage,
    status,
    startedAt: new Date(process.startedAt),
    readyAt: new Date(process.readyAt),
    remainingSeconds: active
      ? Math.max(
          0,
          Math.ceil((process.readyAt.getTime() - now.getTime()) / 1_000),
        )
      : 0,
    accelerationPercent: process.accelerationPercent,
    canComplete: status === 'READY',
    canCancel: active && status !== 'READY',
  }
}

export function temperingCommandResult(input: {
  commandType: TemperingCommandType
  versions: TemperingVersionState
  process: TemperingProcess
  now: Date
}): TemperingCommandResult {
  return {
    commandType: input.commandType,
    characterVersion: input.versions.characterVersion,
    itemVersion: input.versions.itemVersion,
    process: temperingProcessView(input.process, input.now),
    quote: input.process.quote,
  }
}

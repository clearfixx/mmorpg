import type { ResourceType } from './resources'
import type {
  TemperingCancellationSettlement,
  TemperingProcess,
  TemperingQuote,
  TemperingWallet,
} from './tempering-process'
import type { TemperingResolution } from './tempering'

export type TemperingLedgerDirection = 'DEBIT' | 'CREDIT'
export type TemperingLedgerAsset = 'GOLD' | 'STONE' | 'RESOURCE'

export interface TemperingLedgerEntry {
  direction: TemperingLedgerDirection
  asset: TemperingLedgerAsset
  key: string
  amount: number
  reason: 'START' | 'ACCELERATION' | 'CANCELLATION_REFUND'
}

export interface TemperingAttemptRecord {
  processId: string
  itemId: string
  targetStage: number
  startedAt: Date
  resolvedAt: Date
  outcome: TemperingResolution['outcome']
  resultingStage: number
  resultingProgressBasisPoints: number
  guaranteed: boolean
  accelerationPercent: number
}

export interface TemperingItemProjection {
  stage: number
  progressBasisPoints: number
  activeProcessId: string | null
  locked: boolean
}

export function temperingStartLedger(
  quote: TemperingQuote,
): readonly TemperingLedgerEntry[] {
  return [
    debit('GOLD', 'GOLD', quote.gold, 'START'),
    debit('STONE', quote.stoneGrade, quote.stoneAmount, 'START'),
    ...quote.resources.map((cost) =>
      debit('RESOURCE', cost.resourceType, cost.amount, 'START'),
    ),
    ...quote.accelerationResources.map((cost) =>
      debit('RESOURCE', cost.resourceType, cost.amount, 'ACCELERATION'),
    ),
  ]
}

export function temperingCancellationLedger(
  settlement: TemperingCancellationSettlement,
): readonly TemperingLedgerEntry[] {
  return settlement.resourceRefunds.map((cost) =>
    credit('RESOURCE', cost.resourceType, cost.amount, 'CANCELLATION_REFUND'),
  )
}

export function applyTemperingLedger(
  wallet: TemperingWallet,
  entries: readonly TemperingLedgerEntry[],
): TemperingWallet {
  const next: TemperingWallet = {
    gold: wallet.gold,
    stones: { ...wallet.stones },
    resources: { ...wallet.resources },
  }
  for (const entry of entries) {
    const sign = entry.direction === 'DEBIT' ? -1 : 1
    if (entry.asset === 'GOLD') {
      next.gold += sign * entry.amount
      if (next.gold < 0) throw new Error('INSUFFICIENT_GOLD')
      continue
    }
    if (entry.asset === 'STONE') {
      const key = entry.key as keyof TemperingWallet['stones']
      const amount = (next.stones[key] ?? 0) + sign * entry.amount
      if (amount < 0) throw new Error(`INSUFFICIENT_${entry.key}_STONE`)
      next.stones[key] = amount
      continue
    }
    const key = entry.key as ResourceType
    const amount = (next.resources[key] ?? 0) + sign * entry.amount
    if (amount < 0) throw new Error(`INSUFFICIENT_${entry.key}`)
    next.resources[key] = amount
  }
  return next
}

export function assertTemperingQueueAvailable(input: {
  itemId: string
  activeProcesses: readonly Pick<TemperingProcess, 'itemId' | 'status'>[]
  activeProcessCount: number
  queueCapacity: number
}): void {
  if (
    input.queueCapacity < 1 ||
    input.activeProcessCount >= input.queueCapacity
  )
    throw new Error('TEMPERING_QUEUE_FULL')
  if (
    input.activeProcesses.some(
      (process) =>
        process.itemId === input.itemId && process.status === 'IN_PROGRESS',
    )
  )
    throw new Error('ITEM_ALREADY_TEMPERING')
}

export function projectActiveTempering(
  currentStage: number,
  currentProgressBasisPoints: number,
  process: Pick<TemperingProcess, 'id' | 'status'> | null,
): TemperingItemProjection {
  const active = process?.status === 'IN_PROGRESS'
  return {
    stage: currentStage,
    progressBasisPoints: currentProgressBasisPoints,
    activeProcessId: active ? process.id : null,
    locked: active,
  }
}

export function projectCompletedTempering(
  process: TemperingProcess,
): TemperingItemProjection {
  if (!process.resolution) throw new Error('TEMPERING_NOT_RESOLVED')
  return {
    stage: process.resolution.nextStage,
    progressBasisPoints: process.resolution.nextProgressBasisPoints,
    activeProcessId: null,
    locked: false,
  }
}

export function temperingAttemptRecord(
  process: TemperingProcess,
): TemperingAttemptRecord {
  if (!process.resolution || !process.resolvedAt)
    throw new Error('TEMPERING_NOT_RESOLVED')
  return {
    processId: process.id,
    itemId: process.itemId,
    targetStage: process.targetStage,
    startedAt: new Date(process.startedAt),
    resolvedAt: new Date(process.resolvedAt),
    outcome: process.resolution.outcome,
    resultingStage: process.resolution.nextStage,
    resultingProgressBasisPoints: process.resolution.nextProgressBasisPoints,
    guaranteed: process.resolution.guaranteed,
    accelerationPercent: process.accelerationPercent,
  }
}

function debit(
  asset: TemperingLedgerAsset,
  key: string,
  amount: number,
  reason: TemperingLedgerEntry['reason'],
): TemperingLedgerEntry {
  return { direction: 'DEBIT', asset, key, amount, reason }
}

function credit(
  asset: TemperingLedgerAsset,
  key: string,
  amount: number,
  reason: TemperingLedgerEntry['reason'],
): TemperingLedgerEntry {
  return { direction: 'CREDIT', asset, key, amount, reason }
}

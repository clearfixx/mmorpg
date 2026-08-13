import {
  acceleratedDurationSeconds,
  resolveTempering,
  temperingCancellationRefund,
  temperingStage,
  type TemperingResourceCost,
  type TemperingResolution,
  type TemperingStoneGrade,
} from './tempering'
import type { ResourceType } from './resources'

export type TemperingProcessStatus =
  'IN_PROGRESS' | 'READY' | 'SUCCEEDED' | 'PROGRESS_GAINED' | 'CANCELLED'

export interface TemperingWallet {
  gold: number
  stones: Partial<Record<TemperingStoneGrade, number>>
  resources: Partial<Record<ResourceType, number>>
}

export interface TemperingQuote {
  targetStage: number
  durationSeconds: number
  accelerationPercent: number
  gold: number
  stoneGrade: TemperingStoneGrade
  stoneAmount: number
  resources: readonly TemperingResourceCost[]
  accelerationResources: readonly TemperingResourceCost[]
}

export interface TemperingAffordability {
  affordable: boolean
  missing: readonly string[]
}

export interface TemperingProcess {
  id: string
  itemId: string
  startingStage: number
  targetStage: number
  startingProgressBasisPoints: number
  status: TemperingProcessStatus
  startedAt: Date
  readyAt: Date
  accelerationPercent: number
  quote: TemperingQuote
  resolution: TemperingResolution | null
  resolvedAt: Date | null
}

export interface TemperingCancellationSettlement {
  status: 'CANCELLED'
  resourceRefunds: readonly TemperingResourceCost[]
  goldRefund: number
  stoneRefund: number
}

export function quoteTempering(input: {
  currentStage: number
  accelerationPercent?: number
}): TemperingQuote {
  const targetStage = input.currentStage + 1
  const definition = temperingStage(targetStage)
  if (!definition) throw new Error('TEMPERING_COMPLETE')
  const accelerationPercent = Math.min(
    definition.accelerationLimitPercent,
    Math.max(0, Math.floor(input.accelerationPercent ?? 0)),
  )
  return {
    targetStage,
    durationSeconds: acceleratedDurationSeconds(
      targetStage,
      accelerationPercent,
    ),
    accelerationPercent,
    gold: definition.gold,
    stoneGrade: definition.stoneGrade,
    stoneAmount: definition.stoneAmount,
    resources: definition.resources,
    accelerationResources: accelerationCost(targetStage, accelerationPercent),
  }
}

export function temperingAffordability(
  quote: TemperingQuote,
  wallet: TemperingWallet,
): TemperingAffordability {
  const missing: string[] = []
  if (wallet.gold < quote.gold) missing.push(`GOLD:${quote.gold - wallet.gold}`)
  const stones = wallet.stones[quote.stoneGrade] ?? 0
  if (stones < quote.stoneAmount)
    missing.push(`${quote.stoneGrade}_STONE:${quote.stoneAmount - stones}`)
  for (const cost of [...quote.resources, ...quote.accelerationResources]) {
    const available = wallet.resources[cost.resourceType] ?? 0
    if (available < cost.amount)
      missing.push(`${cost.resourceType}:${cost.amount - available}`)
  }
  return { affordable: missing.length === 0, missing }
}

export function startTemperingProcess(input: {
  id: string
  itemId: string
  currentStage: number
  progressBasisPoints: number
  accelerationPercent?: number
  startedAt: Date
}): TemperingProcess {
  const quote = quoteTempering(input)
  return {
    id: input.id,
    itemId: input.itemId,
    startingStage: input.currentStage,
    targetStage: quote.targetStage,
    startingProgressBasisPoints: clampProgress(input.progressBasisPoints),
    status: 'IN_PROGRESS',
    startedAt: new Date(input.startedAt),
    readyAt: new Date(
      input.startedAt.getTime() + quote.durationSeconds * 1_000,
    ),
    accelerationPercent: quote.accelerationPercent,
    quote,
    resolution: null,
    resolvedAt: null,
  }
}

export function temperingProcessStatus(
  process: TemperingProcess,
  now: Date,
): TemperingProcessStatus {
  if (process.status !== 'IN_PROGRESS') return process.status
  return now.getTime() >= process.readyAt.getTime() ? 'READY' : 'IN_PROGRESS'
}

export function completeTemperingProcess(
  process: TemperingProcess,
  input: { now: Date; roll: number },
): TemperingProcess {
  if (process.status !== 'IN_PROGRESS') throw new Error('TEMPERING_NOT_ACTIVE')
  if (input.now.getTime() < process.readyAt.getTime())
    throw new Error('TEMPERING_NOT_READY')
  const resolution = resolveTempering({
    currentStage: process.startingStage,
    progressBasisPoints: process.startingProgressBasisPoints,
    roll: input.roll,
  })
  return {
    ...process,
    status: resolution.outcome === 'SUCCESS' ? 'SUCCEEDED' : 'PROGRESS_GAINED',
    resolution,
    resolvedAt: new Date(input.now),
  }
}

export function cancelTemperingProcess(
  process: TemperingProcess,
  now: Date,
): { process: TemperingProcess; settlement: TemperingCancellationSettlement } {
  if (process.status !== 'IN_PROGRESS') throw new Error('TEMPERING_NOT_ACTIVE')
  return {
    process: {
      ...process,
      status: 'CANCELLED',
      resolvedAt: new Date(now),
    },
    settlement: {
      status: 'CANCELLED',
      resourceRefunds: temperingCancellationRefund(process.targetStage),
      goldRefund: 0,
      stoneRefund: 0,
    },
  }
}

function accelerationCost(
  stage: number,
  accelerationPercent: number,
): readonly TemperingResourceCost[] {
  if (accelerationPercent <= 0) return []
  return [
    {
      resourceType: 'VEIL_ECHO',
      amount: Math.ceil((stage * stage * accelerationPercent) / 10),
      refundable: false,
    },
    {
      resourceType: 'STABILIZED_CATALYST',
      amount: Math.ceil((stage * accelerationPercent) / 5),
      refundable: false,
    },
  ]
}

function clampProgress(value: number): number {
  return Math.min(10_000, Math.max(0, Math.floor(value)))
}

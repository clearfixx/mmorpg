import type { ResourceType } from './resources'
import {
  MAX_TEMPERING_STAGE,
  temperingStage,
  type TemperingStoneGrade,
} from './tempering'
import {
  aggregateTemperingCost,
  type TemperingAggregatedCost,
} from './tempering-preview'
import { quoteTempering, type TemperingProcess } from './tempering-process'

export interface TemperingStageExpectation {
  stage: number
  expectedAttempts: number
  maximumAttempts: number
  expectedDurationSeconds: number
  maximumDurationSeconds: number
  successChanceBasisPoints: number
  failureProgressBasisPoints: number
}

export interface TemperingRoadmapCost {
  gold: number
  stones: Partial<Record<TemperingStoneGrade, number>>
  resources: Partial<Record<ResourceType, number>>
}

export interface TemperingRoadmap {
  fromStage: number
  toStage: number
  accelerationPercent: number
  stages: readonly TemperingStageExpectation[]
  expectedAttempts: number
  maximumAttempts: number
  expectedDurationSeconds: number
  maximumDurationSeconds: number
  expectedCost: TemperingRoadmapCost
  maximumCost: TemperingRoadmapCost
}

export interface TemperingInvestmentSummary {
  completedAttempts: number
  successfulAttempts: number
  progressAttempts: number
  elapsedSeconds: number
  goldSpent: number
  stonesSpent: Partial<Record<TemperingStoneGrade, number>>
  resourcesSpent: Partial<Record<ResourceType, number>>
}

export interface TemperingCancellationPreview {
  elapsedSeconds: number
  progressPercent: number
  returnedResources: Partial<Record<ResourceType, number>>
  lostGold: number
  lostStones: Partial<Record<TemperingStoneGrade, number>>
  lostResources: Partial<Record<ResourceType, number>>
}

export function temperingStageExpectation(
  stage: number,
  accelerationPercent = 0,
): TemperingStageExpectation {
  const definition = temperingStage(stage)
  if (!definition) throw new Error('UNKNOWN_TEMPERING_STAGE')
  const quote = quoteTempering({
    currentStage: stage - 1,
    accelerationPercent,
  })
  if (definition.successChanceBasisPoints >= 10_000)
    return {
      stage,
      expectedAttempts: 1,
      maximumAttempts: 1,
      expectedDurationSeconds: quote.durationSeconds,
      maximumDurationSeconds: quote.durationSeconds,
      successChanceBasisPoints: definition.successChanceBasisPoints,
      failureProgressBasisPoints: definition.failureProgressBasisPoints,
    }

  const failureLimit = Math.ceil(10_000 / definition.failureProgressBasisPoints)
  const maximumAttempts = failureLimit + 1
  const failureChance = 1 - definition.successChanceBasisPoints / 10_000
  let expectedAttempts = 0
  let probabilityReached = 1
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    expectedAttempts += probabilityReached
    probabilityReached *= failureChance
  }
  return {
    stage,
    expectedAttempts,
    maximumAttempts,
    expectedDurationSeconds: Math.ceil(
      expectedAttempts * quote.durationSeconds,
    ),
    maximumDurationSeconds: maximumAttempts * quote.durationSeconds,
    successChanceBasisPoints: definition.successChanceBasisPoints,
    failureProgressBasisPoints: definition.failureProgressBasisPoints,
  }
}

export function temperingRoadmap(input: {
  fromStage: number
  toStage?: number
  accelerationPercent?: number
}): TemperingRoadmap {
  const fromStage = Math.max(0, Math.floor(input.fromStage))
  const toStage = Math.min(
    MAX_TEMPERING_STAGE,
    Math.max(fromStage, Math.floor(input.toStage ?? MAX_TEMPERING_STAGE)),
  )
  const accelerationPercent = Math.max(
    0,
    Math.floor(input.accelerationPercent ?? 0),
  )
  const stages = Array.from({ length: toStage - fromStage }, (_, index) =>
    temperingStageExpectation(fromStage + index + 1, accelerationPercent),
  )
  const expectedCost = emptyCost()
  const maximumCost = emptyCost()
  for (const stage of stages) {
    const cost = aggregateTemperingCost(
      quoteTempering({
        currentStage: stage.stage - 1,
        accelerationPercent,
      }),
    )
    addCost(expectedCost, cost, stage.expectedAttempts, true)
    addCost(maximumCost, cost, stage.maximumAttempts, false)
  }
  return {
    fromStage,
    toStage,
    accelerationPercent,
    stages,
    expectedAttempts: sum(stages.map((stage) => stage.expectedAttempts)),
    maximumAttempts: sum(stages.map((stage) => stage.maximumAttempts)),
    expectedDurationSeconds: sum(
      stages.map((stage) => stage.expectedDurationSeconds),
    ),
    maximumDurationSeconds: sum(
      stages.map((stage) => stage.maximumDurationSeconds),
    ),
    expectedCost,
    maximumCost,
  }
}

export function temperingInvestmentSummary(
  processes: readonly TemperingProcess[],
): TemperingInvestmentSummary {
  const summary: TemperingInvestmentSummary = {
    completedAttempts: 0,
    successfulAttempts: 0,
    progressAttempts: 0,
    elapsedSeconds: 0,
    goldSpent: 0,
    stonesSpent: {},
    resourcesSpent: {},
  }
  for (const process of processes) {
    if (!process.resolution || !process.resolvedAt) continue
    summary.completedAttempts += 1
    if (process.resolution.outcome === 'SUCCESS')
      summary.successfulAttempts += 1
    else summary.progressAttempts += 1
    summary.elapsedSeconds += Math.max(
      0,
      Math.ceil(
        (process.resolvedAt.getTime() - process.startedAt.getTime()) / 1_000,
      ),
    )
    const cost = aggregateTemperingCost(process.quote)
    summary.goldSpent += cost.gold
    increment(summary.stonesSpent, cost.stoneGrade, cost.stoneAmount)
    for (const resource of cost.resources)
      increment(summary.resourcesSpent, resource.resourceType, resource.amount)
  }
  return summary
}

export function temperingCancellationPreview(
  process: TemperingProcess,
  now: Date,
): TemperingCancellationPreview {
  if (process.status !== 'IN_PROGRESS') throw new Error('TEMPERING_NOT_ACTIVE')
  const totalSeconds = Math.max(
    1,
    Math.ceil(
      (process.readyAt.getTime() - process.startedAt.getTime()) / 1_000,
    ),
  )
  const elapsedSeconds = Math.min(
    totalSeconds,
    Math.max(
      0,
      Math.floor((now.getTime() - process.startedAt.getTime()) / 1_000),
    ),
  )
  const cost = aggregateTemperingCost(process.quote)
  const returnedResources: Partial<Record<ResourceType, number>> = {}
  const lostResources: Partial<Record<ResourceType, number>> = {}
  for (const resource of cost.resources) {
    const returned = resource.refundable ? Math.floor(resource.amount * 0.4) : 0
    if (returned > 0)
      increment(returnedResources, resource.resourceType, returned)
    increment(lostResources, resource.resourceType, resource.amount - returned)
  }
  return {
    elapsedSeconds,
    progressPercent: Math.floor((elapsedSeconds * 100) / totalSeconds),
    returnedResources,
    lostGold: cost.gold,
    lostStones: { [cost.stoneGrade]: cost.stoneAmount },
    lostResources,
  }
}

function addCost(
  target: TemperingRoadmapCost,
  cost: TemperingAggregatedCost,
  attempts: number,
  expected: boolean,
): void {
  const scale = (value: number) =>
    expected ? Math.ceil(value * attempts) : value * attempts
  target.gold += scale(cost.gold)
  increment(target.stones, cost.stoneGrade, scale(cost.stoneAmount))
  for (const resource of cost.resources)
    increment(target.resources, resource.resourceType, scale(resource.amount))
}

function emptyCost(): TemperingRoadmapCost {
  return { gold: 0, stones: {}, resources: {} }
}

function increment<K extends string>(
  record: Partial<Record<K, number>>,
  key: K,
  amount: number,
): void {
  record[key] = (record[key] ?? 0) + amount
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

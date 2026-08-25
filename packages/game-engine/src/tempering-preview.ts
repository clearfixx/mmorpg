import type { ItemRarity } from './items'
import type { ResourceType } from './resources'
import {
  MAX_TEMPERING_STAGE,
  temperedStats,
  temperingEligibility,
  temperingStage,
  type TemperedStats,
  type TemperingBinding,
  type TemperingResourceCost,
  type TemperingStoneGrade,
} from './tempering'
import {
  quoteTempering,
  type TemperingQuote,
  type TemperingWallet,
} from './tempering-process'

export interface TemperingAggregatedCost {
  gold: number
  stoneGrade: TemperingStoneGrade
  stoneAmount: number
  resources: readonly TemperingResourceCost[]
}

export interface TemperingStatPreview {
  current: TemperedStats
  onSuccess: TemperedStats
  delta: TemperedStats
}

export interface TemperingPreview {
  eligible: boolean
  blockingReasons: readonly string[]
  currentStage: number
  targetStage: number | null
  progressBasisPoints: number
  successChanceBasisPoints: number
  guaranteed: boolean
  quote: TemperingQuote | null
  totalCost: TemperingAggregatedCost | null
  affordable: boolean
  missing: readonly string[]
  stats: TemperingStatPreview
  warnings: readonly string[]
}

export function aggregateTemperingCost(
  quote: TemperingQuote,
): TemperingAggregatedCost {
  const resources = new Map<
    ResourceType,
    { amount: number; refundable: boolean }
  >()
  for (const cost of [...quote.resources, ...quote.accelerationResources]) {
    const current = resources.get(cost.resourceType)
    resources.set(cost.resourceType, {
      amount: (current?.amount ?? 0) + cost.amount,
      refundable: (current?.refundable ?? true) && cost.refundable,
    })
  }
  return {
    gold: quote.gold,
    stoneGrade: quote.stoneGrade,
    stoneAmount: quote.stoneAmount,
    resources: [...resources.entries()].map(
      ([resourceType, { amount, refundable }]) => ({
        resourceType,
        amount,
        refundable,
      }),
    ),
  }
}

export function temperingPreview(input: {
  heroLevel: number
  itemLevel: number
  rarity: ItemRarity
  binding: TemperingBinding
  currentStage: number
  progressBasisPoints: number
  baseStats: TemperedStats
  wallet: TemperingWallet
  accelerationPercent?: number
}): TemperingPreview {
  const eligibility = temperingEligibility(input)
  const current = temperedStats(input.baseStats, input.currentStage)
  if (!eligibility.eligible)
    return {
      eligible: false,
      blockingReasons: eligibility.reasons,
      currentStage: input.currentStage,
      targetStage: null,
      progressBasisPoints: clampProgress(input.progressBasisPoints),
      successChanceBasisPoints: 0,
      guaranteed: false,
      quote: null,
      totalCost: null,
      affordable: false,
      missing: [],
      stats: { current, onSuccess: current, delta: emptyStats() },
      warnings: [],
    }

  const quote = quoteTempering(input)
  const totalCost = aggregateTemperingCost(quote)
  const next = temperingStage(quote.targetStage)!
  const guaranteed = clampProgress(input.progressBasisPoints) >= 10_000
  const onSuccess = temperedStats(input.baseStats, quote.targetStage)
  const missing = missingCost(totalCost, input.wallet)
  return {
    eligible: true,
    blockingReasons: [],
    currentStage: input.currentStage,
    targetStage: quote.targetStage,
    progressBasisPoints: clampProgress(input.progressBasisPoints),
    successChanceBasisPoints: guaranteed
      ? 10_000
      : next.successChanceBasisPoints,
    guaranteed,
    quote,
    totalCost,
    affordable: missing.length === 0,
    missing,
    stats: {
      current,
      onSuccess,
      delta: subtractStats(onSuccess, current),
    },
    warnings: temperingWarnings(quote, guaranteed),
  }
}

export function temperingWarnings(
  quote: TemperingQuote,
  guaranteed: boolean,
): readonly string[] {
  const warnings = [
    'Золото, камінь гартування та рідкісні реагенти не повертаються після запуску.',
    'Скасування повертає лише частину звичайних матеріалів.',
  ]
  if (!guaranteed)
    warnings.push(
      'Невдала спроба не знищить предмет, але дасть лише прогрес до гарантії.',
    )
  if (quote.accelerationPercent > 0)
    warnings.push('Ресурси прискорення повністю згорають після запуску.')
  if (quote.targetStage === MAX_TEMPERING_STAGE)
    warnings.push('Фінальне іменне гартування неможливо прискорити.')
  return warnings
}

function missingCost(
  cost: TemperingAggregatedCost,
  wallet: TemperingWallet,
): string[] {
  const missing: string[] = []
  if (wallet.gold < cost.gold) missing.push(`GOLD:${cost.gold - wallet.gold}`)
  const stones = wallet.stones[cost.stoneGrade] ?? 0
  if (stones < cost.stoneAmount)
    missing.push(`${cost.stoneGrade}_STONE:${cost.stoneAmount - stones}`)
  for (const resource of cost.resources) {
    const available = wallet.resources[resource.resourceType] ?? 0
    if (available < resource.amount)
      missing.push(`${resource.resourceType}:${resource.amount - available}`)
  }
  return missing
}

function subtractStats(
  next: TemperedStats,
  current: TemperedStats,
): TemperedStats {
  return {
    damage: next.damage - current.damage,
    armor: next.armor - current.armor,
    health: next.health - current.health,
  }
}

function emptyStats(): TemperedStats {
  return { damage: 0, armor: 0, health: 0 }
}

function clampProgress(value: number): number {
  return Math.min(10_000, Math.max(0, Math.floor(value)))
}

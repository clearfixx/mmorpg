import type { ItemRarity } from './items'
import type { ResourceType } from './resources'

export const MAX_TEMPERING_STAGE = 15
export const TEMPERING_MINIMUM_HERO_LEVEL = 60
export const TEMPERING_MINIMUM_ITEM_LEVEL = 50

export const TEMPERING_STONE_GRADES = [
  'DULL',
  'WHOLE',
  'FLAWLESS',
  'MYTHIC',
  'DIVINE',
] as const

export type TemperingStoneGrade = (typeof TEMPERING_STONE_GRADES)[number]
export type TemperingBinding = 'UNBOUND' | 'BOUND_ON_EQUIP' | 'BOUND'
export type TemperingOutcome = 'SUCCESS' | 'PROGRESS'

export interface TemperingResourceCost {
  resourceType: ResourceType
  amount: number
  refundable: boolean
}

export interface TemperingStageDefinition {
  stage: number
  name: string
  durationSeconds: number
  successChanceBasisPoints: number
  failureProgressBasisPoints: number
  cumulativeStatBonusBasisPoints: number
  gold: number
  stoneGrade: TemperingStoneGrade
  stoneAmount: number
  resources: readonly TemperingResourceCost[]
  accelerationLimitPercent: number
  ritualMilestone: boolean
}

export interface TemperingEligibility {
  eligible: boolean
  reasons: readonly string[]
}

export interface TemperedStats {
  damage: number
  armor: number
  health: number
}

export interface TemperingResolution {
  outcome: TemperingOutcome
  nextStage: number
  nextProgressBasisPoints: number
  guaranteed: boolean
}

const RARITY_ORDER: Record<ItemRarity, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
  DIVINE: 6,
}

const HOURS = [
  12, 24, 48, 72, 120, 168, 240, 336, 504, 720, 1_080, 1_440, 2_160, 3_600,
  4_320,
] as const
const SUCCESS = [
  10_000, 10_000, 10_000, 9_000, 8_200, 7_500, 6_500, 5_500, 4_500, 3_500,
  2_800, 2_200, 1_600, 1_200, 10_000,
] as const
const FAILURE_PROGRESS = [
  0, 0, 0, 5_000, 4_000, 3_400, 2_800, 2_400, 2_000, 1_700, 1_500, 1_300, 1_100,
  900, 0,
] as const
const STAT_BONUS = [
  200, 400, 700, 1_000, 1_400, 1_900, 2_500, 3_200, 4_000, 5_000, 6_200, 7_600,
  9_200, 11_000, 13_500,
] as const

export const TEMPERING_STAGES: readonly TemperingStageDefinition[] = HOURS.map(
  (hours, index) => {
    const stage = index + 1
    const stoneGrade = temperingStoneGrade(stage)
    const ritualMilestone = stage % 3 === 0
    const scale = stage * stage
    return {
      stage,
      name: temperingStageName(stage),
      durationSeconds: hours * 60 * 60,
      successChanceBasisPoints: SUCCESS[index]!,
      failureProgressBasisPoints: FAILURE_PROGRESS[index]!,
      cumulativeStatBonusBasisPoints: STAT_BONUS[index]!,
      gold: 25_000 * scale,
      stoneGrade,
      stoneAmount: Math.max(1, Math.ceil(stage / 3)),
      resources: [
        resource('VEIL_STEEL', 4 * scale, true),
        resource('STABILIZED_CATALYST', Math.ceil(scale / 2), false),
        resource('VEIL_ECHO', 2 * stage, false),
        ...(ritualMilestone
          ? [resource(ritualResource(stage), Math.ceil(stage / 6), false)]
          : []),
      ],
      accelerationLimitPercent: stage === MAX_TEMPERING_STAGE ? 0 : 35,
      ritualMilestone,
    }
  },
)

export function temperingStage(stage: number): TemperingStageDefinition | null {
  return TEMPERING_STAGES[Math.floor(stage) - 1] ?? null
}

export function temperingEligibility(input: {
  heroLevel: number
  itemLevel: number
  rarity: ItemRarity
  binding: TemperingBinding
  currentStage: number
}): TemperingEligibility {
  const reasons: string[] = []
  if (input.heroLevel < TEMPERING_MINIMUM_HERO_LEVEL)
    reasons.push(`Потрібен ${TEMPERING_MINIMUM_HERO_LEVEL} рівень героя`)
  if (input.itemLevel < TEMPERING_MINIMUM_ITEM_LEVEL)
    reasons.push(`Потрібен ${TEMPERING_MINIMUM_ITEM_LEVEL} рівень предмета`)
  if (RARITY_ORDER[input.rarity] < RARITY_ORDER.LEGENDARY)
    reasons.push('Потрібна щонайменше легендарна рідкість')
  if (input.binding !== 'BOUND')
    reasons.push('Предмет має бути прив’язаний до героя')
  if (input.currentStage >= MAX_TEMPERING_STAGE)
    reasons.push('Предмет уже досяг максимального ступеня')
  return { eligible: reasons.length === 0, reasons }
}

export function temperedStats(
  base: TemperedStats,
  stage: number,
): TemperedStats {
  if (stage <= 0) return { ...base }
  const definition = temperingStage(Math.min(stage, MAX_TEMPERING_STAGE))
  if (!definition) return { ...base }
  const multiplier = 10_000 + definition.cumulativeStatBonusBasisPoints
  return {
    damage: scaleStat(base.damage, multiplier),
    armor: scaleStat(base.armor, multiplier),
    health: scaleStat(base.health, multiplier),
  }
}

export function resolveTempering(input: {
  currentStage: number
  progressBasisPoints: number
  roll: number
}): TemperingResolution {
  const nextDefinition = temperingStage(input.currentStage + 1)
  if (!nextDefinition) throw new Error('TEMPERING_COMPLETE')
  const progress = clampBasisPoints(input.progressBasisPoints)
  const guaranteed = progress >= 10_000
  const normalizedRoll = ((Math.floor(input.roll) % 10_000) + 10_000) % 10_000
  if (guaranteed || normalizedRoll < nextDefinition.successChanceBasisPoints)
    return {
      outcome: 'SUCCESS',
      nextStage: nextDefinition.stage,
      nextProgressBasisPoints: 0,
      guaranteed,
    }
  return {
    outcome: 'PROGRESS',
    nextStage: input.currentStage,
    nextProgressBasisPoints: Math.min(
      10_000,
      progress + nextDefinition.failureProgressBasisPoints,
    ),
    guaranteed: false,
  }
}

export function acceleratedDurationSeconds(
  stage: number,
  requestedPercent: number,
): number {
  const definition = temperingStage(stage)
  if (!definition) throw new Error('UNKNOWN_TEMPERING_STAGE')
  const reduction = Math.min(
    definition.accelerationLimitPercent,
    Math.max(0, Math.floor(requestedPercent)),
  )
  return Math.ceil(definition.durationSeconds * (1 - reduction / 100))
}

export function temperingCancellationRefund(
  stage: number,
): readonly TemperingResourceCost[] {
  const definition = temperingStage(stage)
  if (!definition) return []
  return definition.resources.flatMap((cost) =>
    cost.refundable ? [{ ...cost, amount: Math.floor(cost.amount * 0.4) }] : [],
  )
}

function temperingStoneGrade(stage: number): TemperingStoneGrade {
  if (stage <= 3) return 'DULL'
  if (stage <= 6) return 'WHOLE'
  if (stage <= 9) return 'FLAWLESS'
  if (stage <= 12) return 'MYTHIC'
  return 'DIVINE'
}

function temperingStageName(stage: number): string {
  return [
    'Перша грань',
    'Друга грань',
    'Печатка жару',
    'Сталева пам’ять',
    'Воля ковадла',
    'Печатка полум’я',
    'Голос металу',
    'Незламний контур',
    'Печатка Завіси',
    'Поза межею сталі',
    'Клятва майстра',
    'Велика печатка',
    'Міфічне осердя',
    'Переддень легенди',
    'Іменне гартування',
  ][stage - 1]!
}

function ritualResource(stage: number): ResourceType {
  if (stage <= 6) return 'CURSED_HEART'
  if (stage <= 9) return 'FALLEN_ELF_EYE'
  return 'DARK_PRIEST_ASH'
}

function resource(
  resourceType: ResourceType,
  amount: number,
  refundable: boolean,
): TemperingResourceCost {
  return { resourceType, amount, refundable }
}

function scaleStat(value: number, multiplierBasisPoints: number): number {
  return Math.round((Math.max(0, value) * multiplierBasisPoints) / 10_000)
}

function clampBasisPoints(value: number): number {
  return Math.min(10_000, Math.max(0, Math.floor(value)))
}

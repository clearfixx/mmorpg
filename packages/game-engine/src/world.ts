import type { ResourceType } from './resources'

export const CINDERHAVEN_UNLOCK_TIER = 50

export function canUnlockCinderhaven(highestClearedTier: number): boolean {
  return highestClearedTier >= CINDERHAVEN_UNLOCK_TIER
}

const HOLLOW_ROAD_DROPS: ReadonlyArray<{
  type: ResourceType
  chance: number
}> = [
  { type: 'IRON', chance: 35 },
  { type: 'COAL', chance: 25 },
  { type: 'LEATHER', chance: 15 },
  { type: 'WEAPON_FRAGMENT', chance: 8 },
]

const DRYAD_FOREST_DROPS: ReadonlyArray<{
  type: ResourceType
  chance: number
}> = [
  { type: 'TIMBER', chance: 38 },
  { type: 'HERBS', chance: 30 },
  { type: 'LEATHER', chance: 14 },
  { type: 'OBSIDIAN_SHARD', chance: 4 },
]

export function hollowRoadResourceDrops(
  rolls: readonly number[],
): Array<{ type: ResourceType; amount: 1 }> {
  return HOLLOW_ROAD_DROPS.flatMap((drop, index) =>
    normalizePercentRoll(rolls[index] ?? 100) < drop.chance
      ? [{ type: drop.type, amount: 1 as const }]
      : [],
  )
}

export function dryadForestResourceDrops(
  rolls: readonly number[],
): Array<{ type: ResourceType; amount: 1 }> {
  return DRYAD_FOREST_DROPS.flatMap((drop, index) =>
    normalizePercentRoll(rolls[index] ?? 100) < drop.chance
      ? [{ type: drop.type, amount: 1 as const }]
      : [],
  )
}

function normalizePercentRoll(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.max(0, Math.min(99, Math.floor(value)))
}

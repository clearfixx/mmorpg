export interface LevelProgression {
  level: number
  experienceIntoLevel: number
  experienceForNextLevel: number
}

export interface LevelBonuses {
  health: number
  damage: number
  armor: number
}

export interface TalentRanks {
  vitality: number
  power: number
  resilience: number
}

export function talentBonuses(ranks: TalentRanks): LevelBonuses {
  return {
    health: Math.max(0, ranks.vitality) * 12,
    damage: Math.max(0, ranks.power) * 3,
    armor: Math.max(0, ranks.resilience) * 2,
  }
}

export function levelBonuses(level: number): LevelBonuses {
  const ranks = Math.max(0, Math.floor(level) - 1)
  return { health: ranks * 8, damage: ranks * 2, armor: ranks }
}

export function totalExperienceForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level))
  return 100 * (safeLevel - 1) ** 2
}

export function progressionForExperience(experience: number): LevelProgression {
  const safeExperience = Math.max(0, Math.floor(experience))
  const level = Math.floor(Math.sqrt(safeExperience / 100)) + 1
  const currentThreshold = totalExperienceForLevel(level)
  const nextThreshold = totalExperienceForLevel(level + 1)
  return {
    level,
    experienceIntoLevel: safeExperience - currentThreshold,
    experienceForNextLevel: nextThreshold - currentThreshold,
  }
}

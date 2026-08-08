export interface LevelProgression {
  level: number
  experienceIntoLevel: number
  experienceForNextLevel: number
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

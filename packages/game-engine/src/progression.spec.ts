import { describe, expect, it } from 'vitest'

import {
  levelBonuses,
  progressionForExperience,
  talentBonuses,
  totalExperienceForLevel,
} from './progression'

describe('hero progression', () => {
  it('uses cumulative quadratic level thresholds', () => {
    expect(totalExperienceForLevel(1)).toBe(0)
    expect(totalExperienceForLevel(2)).toBe(100)
    expect(totalExperienceForLevel(3)).toBe(400)
  })

  it('returns server-ready progress within the current level', () => {
    expect(progressionForExperience(99)).toEqual({
      level: 1,
      experienceIntoLevel: 99,
      experienceForNextLevel: 100,
    })
    expect(progressionForExperience(100)).toEqual({
      level: 2,
      experienceIntoLevel: 0,
      experienceForNextLevel: 300,
    })
  })

  it('turns levels into combat bonuses', () => {
    expect(levelBonuses(1)).toEqual({ health: 0, damage: 0, armor: 0 })
    expect(levelBonuses(3)).toEqual({ health: 16, damage: 4, armor: 2 })
  })

  it('turns talent ranks into combat bonuses', () => {
    expect(talentBonuses({ vitality: 2, power: 1, resilience: 3 })).toEqual({
      health: 24,
      damage: 3,
      armor: 6,
    })
  })
})

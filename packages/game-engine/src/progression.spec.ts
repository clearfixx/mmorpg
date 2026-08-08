import { describe, expect, it } from 'vitest'

import {
  progressionForExperience,
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
})

import { describe, expect, it } from 'vitest'

import { canCharacterPerform } from './capabilities'

describe('character capabilities', () => {
  it('answers only whether the ritual action is currently available', () => {
    expect(
      canCharacterPerform('INVOKE_RITUAL_BOSS', {
        level: 30,
        currentLocation: 'CINDERHAVEN_GATE',
      }),
    ).toBe(true)
    expect(
      canCharacterPerform('INVOKE_RITUAL_BOSS', {
        level: 29,
        currentLocation: 'CINDERHAVEN_GATE',
      }),
    ).toBe(false)
    expect(
      canCharacterPerform('INVOKE_RITUAL_BOSS', {
        level: 99,
        currentLocation: 'HOLLOW_ROAD',
      }),
    ).toBe(false)
  })

  it('keeps unrelated action policies independent', () => {
    const state = {
      level: 60,
      currentLocation: 'CINDERHAVEN_GATE',
      cinderhavenUnlocked: false,
    }
    expect(canCharacterPerform('USE_TEMPERING_FORGE', state)).toBe(true)
    expect(canCharacterPerform('ENTER_DRYAD_FOREST', state)).toBe(false)
  })
})

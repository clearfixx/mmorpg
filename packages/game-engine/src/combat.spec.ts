import { describe, expect, it } from 'vitest'

import { createBattle, resolveTurn } from './combat'

describe('deterministic first battle', () => {
  it('replays identical commands to an identical state', () => {
    const play = () =>
      ['STRIKE', 'GUARD', 'SHIELD_BASH', 'STRIKE'].reduce(
        (state, action) => resolveTurn(state, action as 'STRIKE'),
        createBattle('VANGUARD', 'SEARCH_ARMORY'),
      )
    expect(play()).toEqual(play())
  })

  it('guard clearly mitigates the crushing blow', () => {
    let state = createBattle('VANGUARD', 'INSPECT_TRACKS')
    state = resolveTurn(state, 'STRIKE')
    state = resolveTurn(state, 'STRIKE')
    const before = state.hero.health
    state = resolveTurn(state, 'GUARD')
    expect(before - state.hero.health).toBeLessThan(20)
  })

  it('cannot resolve a completed battle', () => {
    const state = createBattle('ARCANIST', 'REST_BRAZIER')
    state.status = 'WON'
    expect(() => resolveTurn(state, 'ARCANE_BOLT')).toThrow('BATTLE_COMPLETE')
  })

  it('applies server-provided hero level bonuses', () => {
    const state = createBattle('VANGUARD', 'INSPECT_TRACKS', 0, 1, 3)
    expect(state.hero.maxHealth).toBe(156)
    expect(state.levelDamageBonus).toBe(4)
    expect(state.levelArmorBonus).toBe(2)
    expect(resolveTurn(state, 'STRIKE').enemy.health).toBe(103)
  })

  it('creates a distinctly stronger rare seal bearer', () => {
    const ordinary = createBattle('VANGUARD', 'INSPECT_TRACKS', 0, 3, 30)
    const rare = createBattle(
      'VANGUARD',
      'INSPECT_TRACKS',
      0,
      3,
      30,
      undefined,
      true,
    )
    expect(rare.rareEncounter).toBe(true)
    expect(rare.enemyLabel).toBe('Вартовий Забутого Закляття')
    expect(rare.enemy.maxHealth).toBeGreaterThan(ordinary.enemy.maxHealth * 2)
    expect(rare.enemyDamageBonus).toBeGreaterThan(ordinary.enemyDamageBonus)
  })
})

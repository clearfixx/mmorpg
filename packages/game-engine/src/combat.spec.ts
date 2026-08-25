import { describe, expect, it } from 'vitest'

import {
  actionsFor,
  createBattle,
  createDryadForestBattle,
  mitigateEnemyDamage,
  resolveTurn,
} from './combat'

describe('deterministic first battle', () => {
  it('separates basic, equipment, spell, and potion actions', () => {
    const actions = actionsFor('VANGUARD', {
      offHandMode: 'SHIELD',
      healthPotions: 2,
      manaPotions: 1,
    })
    expect(new Set(actions.map((action) => action.kind))).toEqual(
      new Set(['BASIC', 'EQUIPMENT', 'SPELL', 'POTION']),
    )
    expect(actions.find((action) => action.id === 'SHIELD_BASH')?.kind).toBe(
      'EQUIPMENT',
    )
  })

  it('changes the equipment skill with the off-hand item', () => {
    expect(
      actionsFor('VANGUARD', { offHandMode: 'WEAPON' }).some(
        (action) => action.id === 'HEAVY_STRIKE',
      ),
    ).toBe(true)
    expect(
      actionsFor('ARCANIST', { offHandMode: 'FOCUS' }).some(
        (action) => action.id === 'FOCUS_CHANNEL',
      ),
    ).toBe(true)
  })

  it('uses battle potion charges separately from mana', () => {
    const state = createBattle(
      'VANGUARD',
      'SEARCH_ARMORY',
      0,
      1,
      1,
      undefined,
      false,
      { healthPotions: 1, manaPotions: 1 },
    )
    state.hero.health = 40
    const healed = resolveTurn(state, 'HEALTH_POTION')
    expect(
      healed.log.find(
        (entry) =>
          entry.kind === 'HEAL' && entry.message.includes('Зілля відновлення'),
      )?.amount,
    ).toBe(50)
    expect(healed.hero.health).toBeGreaterThan(state.hero.health)
    expect(healed.healthPotionCharges).toBe(0)
    expect(healed.hero.resource).toBeGreaterThanOrEqual(state.hero.resource)
  })
  it('runs the Coren outpost against three simultaneous defenders', () => {
    const state = createDryadForestBattle('VANGUARD', 0, 35, 35)
    expect(state.enemies).toHaveLength(3)

    const afterTurn = resolveTurn(state, 'STRIKE', 'thorn-archer')
    const archer = afterTurn.enemies?.find(
      (enemy) => enemy.id === 'thorn-archer',
    )
    expect(afterTurn.targetEnemyId).toBe('thorn-archer')
    expect(archer?.health).toBeLessThan(archer?.maxHealth ?? 0)
    expect(
      afterTurn.log.filter((entry) => entry.kind === 'ENEMY_DAMAGE'),
    ).toHaveLength(3)
  })
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

  it('uses diminishing armor instead of allowing flat immunity', () => {
    expect(mitigateEnemyDamage(18, 0)).toEqual({
      received: 18,
      blocked: 0,
    })
    expect(mitigateEnemyDamage(102, 405)).toEqual({
      received: 21,
      blocked: 81,
    })
    expect(mitigateEnemyDamage(139, 405)).toEqual({
      received: 28,
      blocked: 111,
    })
  })

  it('keeps total evasion distinct from armor and guarding', () => {
    expect(mitigateEnemyDamage(102, 405, 0.7).received).toBe(6)
    expect(mitigateEnemyDamage(102, 405, 1)).toEqual({
      received: 0,
      blocked: 102,
    })
  })

  it('lets an invoked boss damage a heavily armored level 30 hero', () => {
    const boss = createBattle('VANGUARD', 'REST_BRAZIER', 0, 12, 30, {
      health: 1_395,
      damage: 0,
      armor: 376,
    })
    boss.enemyDamageBonus += 72
    const before = boss.hero.health
    const after = resolveTurn(boss, 'STRIKE')
    expect(after.hero.health).toBeLessThan(before)
    expect(after.log.some((entry) => entry.kind === 'ENEMY_DAMAGE')).toBe(true)
  })
})

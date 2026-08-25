import { describe, expect, it } from 'vitest'

import { aggregateTemperingCost, temperingPreview } from './tempering-preview'
import { quoteTempering } from './tempering-process'

const richWallet = {
  gold: 100_000_000,
  stones: { DULL: 100, WHOLE: 100, FLAWLESS: 100, MYTHIC: 100, DIVINE: 100 },
  resources: {
    VEIL_STEEL: 100_000,
    STABILIZED_CATALYST: 100_000,
    VEIL_ECHO: 100_000,
    CURSED_HEART: 100,
    FALLEN_ELF_EYE: 100,
    DARK_PRIEST_ASH: 100,
  },
}

describe('tempering player preview', () => {
  it('aggregates base and acceleration costs of the same resource', () => {
    const total = aggregateTemperingCost(
      quoteTempering({ currentStage: 9, accelerationPercent: 35 }),
    )
    expect(total.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'VEIL_ECHO', amount: 370 }),
        expect.objectContaining({
          resourceType: 'STABILIZED_CATALYST',
          amount: 120,
        }),
      ]),
    )
  })

  it('does not call a wallet affordable when split costs only look affordable', () => {
    const preview = temperingPreview({
      heroLevel: 60,
      itemLevel: 50,
      rarity: 'LEGENDARY',
      binding: 'BOUND',
      currentStage: 9,
      progressBasisPoints: 0,
      baseStats: { damage: 100, armor: 0, health: 0 },
      accelerationPercent: 35,
      wallet: {
        ...richWallet,
        resources: { ...richWallet.resources, VEIL_ECHO: 350 },
      },
    })
    expect(preview.affordable).toBe(false)
    expect(preview.missing).toContain('VEIL_ECHO:20')
  })

  it('shows exact current, successful and delta stats', () => {
    const preview = temperingPreview({
      heroLevel: 60,
      itemLevel: 50,
      rarity: 'LEGENDARY',
      binding: 'BOUND',
      currentStage: 14,
      progressBasisPoints: 0,
      baseStats: { damage: 100, armor: 50, health: 20 },
      wallet: richWallet,
    })
    expect(preview.stats).toEqual({
      current: { damage: 210, armor: 105, health: 42 },
      onSuccess: { damage: 235, armor: 118, health: 47 },
      delta: { damage: 25, armor: 13, health: 5 },
    })
    expect(preview.warnings).toContain(
      'Фінальне іменне гартування неможливо прискорити.',
    )
  })

  it('turns a full pity meter into an explicit guaranteed chance', () => {
    const preview = temperingPreview({
      heroLevel: 60,
      itemLevel: 50,
      rarity: 'MYTHIC',
      binding: 'BOUND',
      currentStage: 13,
      progressBasisPoints: 10_000,
      baseStats: { damage: 100, armor: 0, health: 0 },
      wallet: richWallet,
    })
    expect(preview).toMatchObject({
      guaranteed: true,
      successChanceBasisPoints: 10_000,
    })
    expect(preview.warnings).not.toContain(
      'Невдала спроба не знищить предмет, але дасть лише прогрес до гарантії.',
    )
  })

  it('returns blocking reasons instead of a misleading quote', () => {
    const preview = temperingPreview({
      heroLevel: 30,
      itemLevel: 20,
      rarity: 'EPIC',
      binding: 'UNBOUND',
      currentStage: 0,
      progressBasisPoints: 0,
      baseStats: { damage: 10, armor: 0, health: 0 },
      wallet: richWallet,
    })
    expect(preview).toMatchObject({
      eligible: false,
      targetStage: null,
      quote: null,
      totalCost: null,
      affordable: false,
    })
    expect(preview.blockingReasons).toHaveLength(4)
  })
})

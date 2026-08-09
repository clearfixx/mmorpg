import { describe, expect, it } from 'vitest'

import {
  CRAFTING_RECIPES,
  craftingDurationSeconds,
  craftingRecipe,
  publicCraftingRecipes,
  scaledIngredients,
} from './crafting'

describe('crafting recipes', () => {
  it('supports multiple ingredients with independent quantities', () => {
    const recipe = CRAFTING_RECIPES['veil-steel-v1']
    expect(scaledIngredients(recipe, 2)).toEqual([
      { resourceType: 'IRON', amount: 20 },
      { resourceType: 'COAL', amount: 6 },
      { resourceType: 'BRONZE', amount: 2 },
    ])
  })

  it('scales duration and output batches deterministically', () => {
    const recipe = CRAFTING_RECIPES['stabilized-catalyst-v1']
    expect(craftingDurationSeconds(recipe, 3)).toBe(5_400)
    expect(recipe.output.amount * 3).toBe(3)
  })

  it('does not disclose unknown recipe identifiers', () => {
    expect(craftingRecipe('veil-steel-v1')).not.toBeNull()
    expect(craftingRecipe('hidden-ascension')).toBeNull()
    expect(publicCraftingRecipes().map((recipe) => recipe.id)).not.toContain(
      'tempered-veil-steel-v1',
    )
  })

  it('keeps hidden formulas available to the authoritative engine', () => {
    expect(craftingRecipe('tempered-veil-steel-v1')).toMatchObject({
      public: false,
      station: 'FORGE',
    })
  })
})

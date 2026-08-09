import type { ResourceType } from './resources'

export const CRAFTING_STATIONS = [
  'WORKSHOP',
  'ALCHEMY_TABLE',
  'FORGE',
  'RITUAL_CIRCLE',
] as const

export type CraftingStation = (typeof CRAFTING_STATIONS)[number]

export interface RecipeIngredient {
  resourceType: ResourceType
  amount: number
}

export interface CraftingRecipe {
  id: string
  name: string
  description: string
  station: CraftingStation
  durationSeconds: number
  ingredients: readonly RecipeIngredient[]
  output: RecipeIngredient
  public: boolean
}

export const CRAFTING_RECIPES = {
  'stabilized-catalyst-v1': {
    id: 'stabilized-catalyst-v1',
    name: 'Стабілізований каталізатор',
    description:
      'Алхімічна основа для складних перетворень і ритуальних формул.',
    station: 'ALCHEMY_TABLE',
    durationSeconds: 30 * 60,
    ingredients: [
      { resourceType: 'COPPER', amount: 5 },
      { resourceType: 'BRONZE', amount: 2 },
      { resourceType: 'HERBS', amount: 3 },
    ],
    output: { resourceType: 'STABILIZED_CATALYST', amount: 1 },
    public: true,
  },
  'veil-steel-v1': {
    id: 'veil-steel-v1',
    name: 'Сталь Завіси',
    description:
      'Стабільний ковальський сплав, якого неможливо знайти готовим у звичайному бою.',
    station: 'FORGE',
    durationSeconds: 10 * 60,
    ingredients: [
      { resourceType: 'IRON', amount: 10 },
      { resourceType: 'COAL', amount: 3 },
      { resourceType: 'BRONZE', amount: 1 },
    ],
    output: { resourceType: 'VEIL_STEEL', amount: 1 },
    public: true,
  },
  'tempered-veil-steel-v1': {
    id: 'tempered-veil-steel-v1',
    name: 'Гартована сталь Завіси',
    description:
      'Прихована формула, що замінює грубу бронзу стабілізованим каталізатором.',
    station: 'FORGE',
    durationSeconds: 20 * 60,
    ingredients: [
      { resourceType: 'IRON', amount: 6 },
      { resourceType: 'COAL', amount: 2 },
      { resourceType: 'STABILIZED_CATALYST', amount: 1 },
    ],
    output: { resourceType: 'VEIL_STEEL', amount: 1 },
    public: false,
  },
} as const satisfies Record<string, CraftingRecipe>

export type CraftingRecipeId = keyof typeof CRAFTING_RECIPES

export function craftingRecipe(id: string): CraftingRecipe | null {
  return CRAFTING_RECIPES[id as CraftingRecipeId] ?? null
}

export function publicCraftingRecipes(): CraftingRecipe[] {
  return Object.values(CRAFTING_RECIPES).filter((recipe) => recipe.public)
}

export function scaledIngredients(
  recipe: CraftingRecipe,
  quantity: number,
): RecipeIngredient[] {
  const safeQuantity = Math.max(1, Math.floor(quantity))
  return recipe.ingredients.map((ingredient) => ({
    resourceType: ingredient.resourceType,
    amount: ingredient.amount * safeQuantity,
  }))
}

export function craftingDurationSeconds(
  recipe: CraftingRecipe,
  quantity: number,
): number {
  return recipe.durationSeconds * Math.max(1, Math.floor(quantity))
}

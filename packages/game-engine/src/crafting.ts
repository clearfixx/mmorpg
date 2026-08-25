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
  'health-potion-v1': {
    id: 'health-potion-v1',
    name: 'Зілля відновлення',
    description: 'Простий бойовий настій для відновлення здоров’я.',
    station: 'ALCHEMY_TABLE',
    durationSeconds: 20,
    ingredients: [
      { resourceType: 'HERBS', amount: 3 },
      { resourceType: 'TIMBER', amount: 1 },
    ],
    output: { resourceType: 'HEALTH_POTION', amount: 1 },
    public: true,
  },
  'mana-potion-v1': {
    id: 'mana-potion-v1',
    name: 'Зілля мани',
    description: 'Нестійкий настій для відновлення мани під час бою.',
    station: 'ALCHEMY_TABLE',
    durationSeconds: 30,
    ingredients: [
      { resourceType: 'HERBS', amount: 2 },
      { resourceType: 'OBSIDIAN_SHARD', amount: 1 },
    ],
    output: { resourceType: 'MANA_POTION', amount: 1 },
    public: true,
  },
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
  'dark-priest-invocation-seal-v1': {
    id: 'dark-priest-invocation-seal-v1',
    name: 'Печатка Темного жерця',
    description:
      'Ритуальна перековка змінює відбиток звичайної печатки та відкриває альтернативну гілку полювання.',
    station: 'RITUAL_CIRCLE',
    durationSeconds: 6 * 60 * 60,
    ingredients: [
      { resourceType: 'BOSS_INVOCATION_SEAL', amount: 1 },
      { resourceType: 'STABILIZED_CATALYST', amount: 1 },
      { resourceType: 'OBSIDIAN_SHARD', amount: 3 },
    ],
    output: { resourceType: 'DARK_PRIEST_INVOCATION_SEAL', amount: 1 },
    public: true,
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

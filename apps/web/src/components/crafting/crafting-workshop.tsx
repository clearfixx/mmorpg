'use client'

import {
  ArrowLeft,
  FlaskConical,
  Hammer,
  PackageCheck,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  GameHeroBanner,
  GameMetric,
  GamePanel,
  gameUi,
} from '@/components/game-ui/game-dashboard'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const favoriteRecipesKey = 'veilfall.favorite-recipes'
const craftingViewKey = 'veilfall.crafting-view'
const recipesPerPage = 12
const craftingStations: CraftingStation[] = [
  'FORGE',
  'ALCHEMY_TABLE',
  'WORKSHOP',
  'RITUAL_CIRCLE',
]

type CraftingStation = 'WORKSHOP' | 'ALCHEMY_TABLE' | 'FORGE' | 'RITUAL_CIRCLE'
type RecipeAvailability = 'ALL' | 'AVAILABLE' | 'MISSING' | 'DISCOVERED'
type RecipeSort = 'NAME' | 'DURATION' | 'CRAFTABLE'

interface CraftingRecipe {
  id: string
  name: string
  description: string
  station: CraftingStation
  durationSeconds: number
  ingredients: Array<{
    resourceType: string
    name: string
    amount: number
    available: number
  }>
  outputType: string
  outputName: string
  outputAmount: number
  affordable: boolean
  stationAvailable: boolean
  discovered: boolean
}

interface CraftJob {
  id: string
  recipeId: string
  recipeName: string
  station: CraftingStation
  status: 'ACTIVE' | 'CLAIMED'
  quantity: number
  outputType: string
  outputName: string
  outputAmount: number
  startedAt: string
  completesAt: string
  remainingSeconds: number
  ready: boolean
}

interface CraftingState {
  recipes: CraftingRecipe[]
  jobs: CraftJob[]
}

const craftingFields = `
  recipes {
    id name description station durationSeconds
    ingredients { resourceType name amount available }
    outputType outputName outputAmount affordable stationAvailable discovered
  }
  jobs {
    id recipeId recipeName station status quantity
    outputType outputName outputAmount startedAt completesAt
    remainingSeconds ready
  }
`

export function CraftingWorkshop({
  onBack,
  onOpenTempering,
}: {
  onBack: () => void
  onOpenTempering?: () => void
}) {
  const [crafting, setCrafting] = useState<CraftingState | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [stationFilter, setStationFilter] = useState<CraftingStation | 'ALL'>(
    'ALL',
  )
  const [availabilityFilter, setAvailabilityFilter] =
    useState<RecipeAvailability>('ALL')
  const [recipeSort, setRecipeSort] = useState<RecipeSort>('CRAFTABLE')
  const [recipePage, setRecipePage] = useState(1)
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [claimingAll, setClaimingAll] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    void executeCraftingQuery(`{ myCrafting { ${craftingFields} } }`).then(
      (data) => setCrafting(data.myCrafting),
      () => setError('Не вдалося відкрити майстерню.'),
    )
  }, [])

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(favoriteRecipesKey)
        if (stored) setFavoriteRecipeIds(JSON.parse(stored) as string[])
      } catch {
        window.localStorage.removeItem(favoriteRecipesKey)
      }
    }, 0)
    return () => window.clearTimeout(restore)
  }, [])

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(craftingViewKey)
        if (!stored) return
        const view = JSON.parse(stored) as {
          selectedRecipeId?: string
          stationFilter?: CraftingStation | 'ALL'
          availabilityFilter?: RecipeAvailability
          recipeSort?: RecipeSort
        }
        setSelectedRecipeId(view.selectedRecipeId ?? null)
        setStationFilter(view.stationFilter ?? 'ALL')
        setAvailabilityFilter(view.availabilityFilter ?? 'ALL')
        setRecipeSort(view.recipeSort ?? 'CRAFTABLE')
      } catch {
        window.localStorage.removeItem(craftingViewKey)
      }
    }, 0)
    return () => window.clearTimeout(restore)
  }, [])

  const hasActiveJobs =
    crafting?.jobs.some((job) => job.status === 'ACTIVE') ?? false

  useEffect(() => {
    if (!hasActiveJobs) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [hasActiveJobs])

  async function refreshCrafting() {
    setRefreshing(true)
    setError(null)
    try {
      const data = await executeCraftingQuery(
        `{ myCrafting { ${craftingFields} } }`,
      )
      setCrafting(data.myCrafting)
    } catch {
      setError('Не вдалося оновити стан майстерні.')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!hasActiveJobs) return
    const refresh = window.setInterval(() => {
      void executeCraftingQuery(`{ myCrafting { ${craftingFields} } }`).then(
        (data) => setCrafting(data.myCrafting),
      )
    }, 15_000)
    return () => window.clearInterval(refresh)
  }, [hasActiveJobs])

  async function startCraft(recipe: CraftingRecipe) {
    const quantity = quantities[recipe.id] ?? 1
    setPendingId(recipe.id)
    setError(null)
    try {
      const data = await executeCraftingQuery(
        `mutation Start($input: StartCraftInput!) {
          startCraft(input: $input) { ${craftingFields} }
        }`,
        {
          input: {
            recipeId: recipe.id,
            quantity,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setCrafting(data.startCraft)
    } catch {
      setError('Не вдалося почати створення. Перевірте компоненти та станцію.')
    } finally {
      setPendingId(null)
    }
  }

  async function claimCraft(job: CraftJob) {
    setPendingId(job.id)
    setError(null)
    try {
      const data = await executeCraftingQuery(
        `mutation Claim($input: ClaimCraftInput!) {
          claimCraft(input: $input) { ${craftingFields} }
        }`,
        {
          input: {
            craftJobId: job.id,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setCrafting(data.claimCraft)
    } catch {
      setError('Результат ще не готовий або вже був отриманий.')
    } finally {
      setPendingId(null)
    }
  }

  async function claimAllReady(jobs: CraftJob[]) {
    setClaimingAll(true)
    setError(null)
    try {
      let latest: CraftingState | null = null
      for (const job of jobs) {
        const data = await executeCraftingQuery(
          `mutation Claim($input: ClaimCraftInput!) {
            claimCraft(input: $input) { ${craftingFields} }
          }`,
          {
            input: {
              craftJobId: job.id,
              idempotencyKey: crypto.randomUUID(),
            },
          },
        )
        latest = data.claimCraft
      }
      if (latest) setCrafting(latest)
    } catch {
      setError('Не всі готові результати вдалося забрати. Оновіть чергу.')
    } finally {
      setClaimingAll(false)
    }
  }

  if (!crafting)
    return (
      <section className="mt-8 border-t border-border/70 pt-7">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mb-5 h-8 rounded-sm px-2"
        >
          <ArrowLeft aria-hidden="true" /> До міських кварталів
        </Button>
        <p className="text-sm text-muted-foreground">
          Майстри переглядають ваші записи…
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    )

  const visibleJobs = crafting.jobs.filter(
    (job) =>
      job.status === 'ACTIVE' || now - Date.parse(job.startedAt) < 86_400_000,
  )
  const readyJobs = visibleJobs.filter(
    (job) => job.status === 'ACTIVE' && Date.parse(job.completesAt) <= now,
  )
  const activeJobs = crafting.jobs.filter((job) => job.status === 'ACTIVE')
  const completedJobs = crafting.jobs
    .filter((job) => job.status === 'CLAIMED')
    .slice(0, 8)
  const selectedRecipe =
    crafting.recipes.find((recipe) => recipe.id === selectedRecipeId) ??
    crafting.recipes[0]
  const selectedQuantity = selectedRecipe
    ? (quantities[selectedRecipe.id] ?? 1)
    : 1
  const selectedMaxQuantity = selectedRecipe
    ? Math.min(
        100,
        ...selectedRecipe.ingredients.map((ingredient) =>
          Math.floor(ingredient.available / ingredient.amount),
        ),
      )
    : 0
  const canCraftSelected =
    selectedRecipe?.ingredients.every(
      (ingredient) =>
        ingredient.available >= ingredient.amount * selectedQuantity,
    ) ?? false
  const missingIngredients = selectedRecipe
    ? selectedRecipe.ingredients
        .map((ingredient) => ({
          ...ingredient,
          required: ingredient.amount * selectedQuantity,
          missing: Math.max(
            0,
            ingredient.amount * selectedQuantity - ingredient.available,
          ),
        }))
        .filter((ingredient) => ingredient.missing > 0)
    : []
  const query = recipeSearch.trim().toLocaleLowerCase('uk')
  const filteredRecipes = crafting.recipes.filter(
    (recipe) =>
      (stationFilter === 'ALL' || recipe.station === stationFilter) &&
      (availabilityFilter === 'ALL' ||
        (availabilityFilter === 'AVAILABLE' &&
          recipe.affordable &&
          recipe.stationAvailable) ||
        (availabilityFilter === 'MISSING' && !recipe.affordable) ||
        (availabilityFilter === 'DISCOVERED' && recipe.discovered)) &&
      (!query ||
        recipe.name.toLocaleLowerCase('uk').includes(query) ||
        recipe.description.toLocaleLowerCase('uk').includes(query) ||
        recipe.ingredients.some((ingredient) =>
          ingredient.name.toLocaleLowerCase('uk').includes(query),
        )),
  )
  const sortedRecipes = [...filteredRecipes].sort((left, right) => {
    if (recipeSort === 'DURATION')
      return left.durationSeconds - right.durationSeconds
    if (recipeSort === 'CRAFTABLE') {
      const leftScore = Number(left.affordable && left.stationAvailable)
      const rightScore = Number(right.affordable && right.stationAvailable)
      if (leftScore !== rightScore) return rightScore - leftScore
    }
    return left.name.localeCompare(right.name, 'uk')
  })
  const recipePageCount = Math.max(
    1,
    Math.ceil(sortedRecipes.length / recipesPerPage),
  )
  const currentRecipePage = Math.min(recipePage, recipePageCount)
  const pagedRecipes = sortedRecipes.slice(
    (currentRecipePage - 1) * recipesPerPage,
    currentRecipePage * recipesPerPage,
  )
  const favoriteRecipes = favoriteRecipeIds
    .map((id) => crafting.recipes.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is CraftingRecipe => Boolean(recipe))
  const quickRecipes = [
    ...favoriteRecipes,
    ...crafting.recipes.filter(
      (recipe) => !favoriteRecipeIds.includes(recipe.id),
    ),
  ].slice(0, 4)

  function toggleFavorite(recipeId: string) {
    setFavoriteRecipeIds((current) => {
      const next = current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId].slice(-4)
      window.localStorage.setItem(favoriteRecipesKey, JSON.stringify(next))
      return next
    })
  }

  function persistView(next: {
    selectedRecipeId?: string | null
    stationFilter?: CraftingStation | 'ALL'
    availabilityFilter?: RecipeAvailability
    recipeSort?: RecipeSort
  }) {
    const current = {
      selectedRecipeId,
      stationFilter,
      availabilityFilter,
      recipeSort,
    }
    window.localStorage.setItem(
      craftingViewKey,
      JSON.stringify({ ...current, ...next }),
    )
  }

  function selectRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId)
    persistView({ selectedRecipeId: recipeId })
    document
      .getElementById('crafting-workbench')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className={`mt-3 ${gameUi.pageGap}`}>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="h-8 rounded-sm px-2"
      >
        <ArrowLeft aria-hidden="true" /> До міських кварталів
      </Button>
      <GameHeroBanner
        eyebrow="Попелястий Прихисток · ремісничий квартал"
        title="Майстерня"
        subtitle="Кузня, алхімія та ритуальні формули"
        description={
          <p>
            Оберіть відому формулу, підготуйте потрібну кількість компонентів і
            передайте роботу відповідній станції. Довгі процеси не блокують інші
            ремесла.
          </p>
        }
        footer={
          <p className="font-mono text-[0.6rem] text-muted-foreground">
            Відомих рецептів: {crafting.recipes.length} · паралельних станцій: 4
          </p>
        }
        aside={
          <>
            <p className="font-mono text-[0.58rem] uppercase tracking-wider text-ember">
              Стан майстерні
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-px bg-border/60">
              <GameMetric
                label="Активні"
                value={
                  crafting.jobs.filter((job) => job.status === 'ACTIVE').length
                }
              />
              <GameMetric label="Місткість" value="4 станції" />
              <GameMetric label="Обрано" value={selectedRecipe?.name ?? '—'} />
              <GameMetric label="Кількість" value={selectedQuantity} />
            </dl>
            {onOpenTempering ? (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenTempering}
                className="mt-3 h-8 w-full rounded-sm text-xs"
              >
                <Hammer className="size-3.5" /> Висока кузня
              </Button>
            ) : null}
          </>
        }
      />

      <GamePanel
        eyebrow="Робочі місця"
        title="Стан ремісничих станцій"
        action={
          <Button
            type="button"
            variant="outline"
            disabled={refreshing}
            onClick={() => void refreshCrafting()}
            className="h-8 rounded-sm text-xs"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Оновлюємо…' : 'Оновити'}
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {craftingStations.map((station) => {
            const job = activeJobs.find((entry) => entry.station === station)
            const remaining = job
              ? Math.max(
                  0,
                  Math.ceil((Date.parse(job.completesAt) - now) / 1_000),
                )
              : 0
            return (
              <article
                key={station}
                className="border border-border/70 bg-background/55 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-serif text-sm">{stationName(station)}</p>
                  <span
                    className={`font-mono text-[0.58rem] uppercase ${job ? 'text-ember' : 'text-moss'}`}
                  >
                    {job ? 'Зайнята' : 'Вільна'}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {job ? job.recipeName : 'Готова прийняти нову формулу'}
                </p>
                <p className="mt-2 font-mono text-[0.62rem]">
                  {job
                    ? remaining === 0
                      ? 'Результат готовий'
                      : formatDuration(remaining)
                    : 'Без черги'}
                </p>
              </article>
            )
          })}
        </div>
      </GamePanel>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <GamePanel
          id="crafting-workbench"
          eyebrow="Робоче місце"
          title="Кузня формул"
        >
          {selectedRecipe ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[0.58rem] uppercase text-moss">
                      {stationName(selectedRecipe.station)}
                    </p>
                    <h3 className="mt-1 font-serif text-xl">
                      {selectedRecipe.name}
                    </h3>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                      {selectedRecipe.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      document
                        .getElementById('known-recipes')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="h-8 rounded-sm text-xs"
                  >
                    Книга рецептів
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedRecipe.ingredients.map((ingredient) => {
                    const required = ingredient.amount * selectedQuantity
                    const enough = ingredient.available >= required
                    return (
                      <div
                        key={ingredient.resourceType}
                        className="border border-border/70 bg-background/55 p-3"
                      >
                        <div className="grid size-10 place-items-center border border-ember/30 bg-ember/5">
                          <PackageCheck className="size-4 text-ember" />
                        </div>
                        <p className="mt-2 text-xs">{ingredient.name}</p>
                        <p
                          className={`mt-1 font-mono text-[0.65rem] ${enough ? 'text-moss' : 'text-destructive'}`}
                        >
                          потрібно / є: {required}/{ingredient.available}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 grid grid-cols-[5rem_auto_1fr] gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={selectedQuantity}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [selectedRecipe.id]: Math.min(
                          100,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      }))
                    }
                    aria-label={`Кількість для рецепта ${selectedRecipe.name}`}
                    className="h-9 rounded-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={selectedMaxQuantity < 1}
                    onClick={() =>
                      setQuantities((current) => ({
                        ...current,
                        [selectedRecipe.id]: selectedMaxQuantity,
                      }))
                    }
                    className="h-9 rounded-sm text-xs"
                  >
                    Макс. {selectedMaxQuantity}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      pendingId !== null ||
                      !selectedRecipe.stationAvailable ||
                      !canCraftSelected
                    }
                    onClick={() => void startCraft(selectedRecipe)}
                    className="h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
                  >
                    {pendingId === selectedRecipe.id
                      ? 'Запускаємо…'
                      : !selectedRecipe.stationAvailable
                        ? 'Станція зайнята'
                        : !canCraftSelected
                          ? 'Бракує компонентів'
                          : 'Почати створення'}
                  </Button>
                </div>
                {missingIngredients.length > 0 ? (
                  <div className="mt-3 border-l-2 border-destructive bg-destructive/5 px-3 py-2">
                    <p className="font-mono text-[0.58rem] uppercase text-destructive">
                      Не вистачає для партії
                    </p>
                    <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      {missingIngredients.map((ingredient) => (
                        <li
                          key={ingredient.resourceType}
                          className="flex justify-between gap-3"
                        >
                          <span>{ingredient.name}</span>
                          <span className="font-mono text-destructive">
                            −{ingredient.missing}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col border border-ember/35 bg-background/55 p-3 text-center">
                <div className="grid aspect-square place-items-center bg-[radial-gradient(circle,oklch(0.5_0.1_45/20%),transparent_65%)]">
                  {selectedRecipe.station === 'ALCHEMY_TABLE' ? (
                    <FlaskConical className="size-14 text-moss" />
                  ) : (
                    <Hammer className="size-14 text-ember" />
                  )}
                </div>
                <p className="mt-2 font-serif text-sm">
                  {selectedRecipe.outputName}
                </p>
                <p className="mt-1 font-mono text-[0.62rem] text-ember">
                  {selectedRecipe.outputAmount * selectedQuantity} шт.
                </p>
                <p className="mt-2 text-[0.62rem] text-muted-foreground">
                  Доступно створити: {selectedMaxQuantity}
                </p>
                <p className="mt-auto pt-4 font-mono text-[0.62rem] text-muted-foreground">
                  {formatDuration(
                    selectedRecipe.durationSeconds * selectedQuantity,
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </GamePanel>

        <aside className="space-y-2">
          <GamePanel
            eyebrow="Черга"
            title={`Створення · ${visibleJobs.length}/4`}
            action={
              readyJobs.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={claimingAll}
                  onClick={() => void claimAllReady(readyJobs)}
                  className="h-7 rounded-sm text-[0.62rem]"
                >
                  {claimingAll
                    ? 'Отримуємо…'
                    : `Забрати всі · ${readyJobs.length}`}
                </Button>
              ) : null
            }
          >
            <div className="space-y-2">
              {visibleJobs.length ? (
                visibleJobs.map((job) => {
                  const remaining = Math.max(
                    0,
                    Math.ceil((Date.parse(job.completesAt) - now) / 1_000),
                  )
                  const ready = job.status === 'ACTIVE' && remaining === 0
                  const totalDuration = Math.max(
                    1,
                    Date.parse(job.completesAt) - Date.parse(job.startedAt),
                  )
                  const progress = Math.min(
                    100,
                    Math.max(
                      0,
                      ((now - Date.parse(job.startedAt)) / totalDuration) * 100,
                    ),
                  )
                  return (
                    <article
                      key={job.id}
                      className="border border-border/60 bg-background/55 p-3"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-xs">{job.recipeName}</p>
                        <span
                          className={
                            ready
                              ? 'text-moss'
                              : 'font-mono text-[0.62rem] text-ember'
                          }
                        >
                          {ready ? 'Готово' : formatDuration(remaining)}
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden bg-border/60">
                        <div
                          className={`h-full ${ready ? 'bg-moss' : 'bg-ember'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!ready || pendingId === job.id}
                        onClick={() => void claimCraft(job)}
                        className="mt-2 h-7 w-full rounded-sm text-[0.65rem]"
                      >
                        {pendingId === job.id
                          ? 'Отримуємо…'
                          : ready
                            ? 'Забрати результат'
                            : 'Створення триває'}
                      </Button>
                    </article>
                  )
                })
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Усі станції вільні. Оберіть формулу й почніть роботу.
                </p>
              )}
            </div>
          </GamePanel>
          <GamePanel eyebrow="Порада майстра" title="Паралельні процеси">
            <p className="text-xs leading-5 text-muted-foreground">
              Кузня, алхімічний стіл і ритуальне коло мають окремі черги. Довгий
              ритуал не зупиняє звичайне ремесло.
            </p>
          </GamePanel>
        </aside>
      </div>

      <GamePanel eyebrow="Швидкий доступ" title="Обрані формули">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickRecipes.map((recipe) => (
            <RecipeChoiceCard
              key={recipe.id}
              recipe={recipe}
              compact
              selected={recipe.id === selectedRecipe?.id}
              onSelect={() => selectRecipe(recipe.id)}
              favorite={favoriteRecipeIds.includes(recipe.id)}
              onToggleFavorite={() => toggleFavorite(recipe.id)}
            />
          ))}
        </div>
      </GamePanel>

      <GamePanel eyebrow="Журнал майстерні" title="Завершені роботи">
        {completedJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-xs">
              <thead className="font-mono text-[0.58rem] uppercase text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th className="px-2 py-2 font-normal">Формула</th>
                  <th className="px-2 py-2 font-normal">Станція</th>
                  <th className="px-2 py-2 font-normal">Результат</th>
                  <th className="px-2 py-2 font-normal">Партія</th>
                  <th className="px-2 py-2 text-right font-normal">
                    Завершено
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {completedJobs.map((job) => (
                  <tr key={job.id} className="bg-background/35">
                    <td className="px-2 py-2 font-medium">{job.recipeName}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {stationName(job.station)}
                    </td>
                    <td className="px-2 py-2 text-ember">
                      {job.outputAmount} × {job.outputName}
                    </td>
                    <td className="px-2 py-2 font-mono">{job.quantity}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {formatCraftDate(job.completesAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
            Завершені й отримані роботи з’являться у цьому журналі.
          </p>
        )}
      </GamePanel>

      <GamePanel
        id="known-recipes"
        eyebrow="Відомі знання"
        title="Книга рецептів"
      >
        <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recipeSearch}
              onChange={(event) => {
                setRecipeSearch(event.target.value)
                setRecipePage(1)
              }}
              placeholder="Пошук за назвою, описом або інгредієнтом…"
              className="h-9 rounded-sm pl-9"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {(
              [
                'ALL',
                'FORGE',
                'ALCHEMY_TABLE',
                'WORKSHOP',
                'RITUAL_CIRCLE',
              ] as const
            ).map((station) => (
              <Button
                key={station}
                type="button"
                variant={stationFilter === station ? 'secondary' : 'outline'}
                onClick={() => {
                  setStationFilter(station)
                  setRecipePage(1)
                  persistView({ stationFilter: station })
                }}
                className="h-9 rounded-sm px-3 text-[0.65rem]"
              >
                {station === 'ALL' ? 'Усі' : stationName(station)}
              </Button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-y border-border/60 py-2">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['ALL', 'Усі формули'],
                ['AVAILABLE', 'Можна створити'],
                ['MISSING', 'Бракує ресурсів'],
                ['DISCOVERED', 'Особисті відкриття'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={availabilityFilter === value ? 'secondary' : 'ghost'}
                onClick={() => {
                  setAvailabilityFilter(value)
                  setRecipePage(1)
                  persistView({ availabilityFilter: value })
                }}
                className="h-7 rounded-sm px-2 text-[0.62rem]"
              >
                {label}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
            Сортування
            <select
              value={recipeSort}
              onChange={(event) => {
                const next = event.target.value as RecipeSort
                setRecipeSort(next)
                setRecipePage(1)
                persistView({ recipeSort: next })
              }}
              className="h-8 border border-border/70 bg-background px-2 text-foreground outline-none"
            >
              <option value="CRAFTABLE">Спочатку доступні</option>
              <option value="NAME">За назвою</option>
              <option value="DURATION">За часом</option>
            </select>
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {pagedRecipes.map((recipe) => (
            <RecipeChoiceCard
              key={recipe.id}
              recipe={recipe}
              selected={recipe.id === selectedRecipe?.id}
              onSelect={() => selectRecipe(recipe.id)}
              favorite={favoriteRecipeIds.includes(recipe.id)}
              onToggleFavorite={() => toggleFavorite(recipe.id)}
            />
          ))}
        </div>
        {sortedRecipes.length === 0 ? (
          <p className="border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            Серед відомих формул нічого не знайдено.
          </p>
        ) : null}
        {sortedRecipes.length > 0 ? (
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
            <span className="text-muted-foreground">
              Показано {(currentRecipePage - 1) * recipesPerPage + 1}–
              {Math.min(
                currentRecipePage * recipesPerPage,
                sortedRecipes.length,
              )}{' '}
              із {sortedRecipes.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentRecipePage === 1}
                onClick={() => setRecipePage((page) => Math.max(1, page - 1))}
                className="h-7 rounded-sm"
              >
                Назад
              </Button>
              <span className="font-mono">
                {currentRecipePage}/{recipePageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={currentRecipePage === recipePageCount}
                onClick={() =>
                  setRecipePage((page) => Math.min(recipePageCount, page + 1))
                }
                className="h-7 rounded-sm"
              >
                Далі
              </Button>
            </div>
          </div>
        ) : null}
      </GamePanel>

      <div className="grid gap-2 md:grid-cols-3">
        <GamePanel eyebrow="Де шукати" title="Матеріали">
          <p className="text-xs leading-5 text-muted-foreground">
            Різні регіони мають власні набори ресурсів. Повертайтеся до старих
            маршрутів за базовими компонентами.
          </p>
        </GamePanel>
        <GamePanel eyebrow="Таємні знання" title="Приховані формули">
          <p className="text-xs leading-5 text-muted-foreground">
            Не всі поєднання записані у книзі. Рідкісні NPC та уривки лору
            можуть підказати новий рецепт.
          </p>
        </GamePanel>
        <GamePanel eyebrow="Правило майстра" title="Час має ціну">
          <p className="text-xs leading-5 text-muted-foreground">
            Складні формули потребують більше часу, але не позбавляють доступу
            до інших станцій.
          </p>
        </GamePanel>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-5 border-l-2 border-destructive px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}

function RecipeChoiceCard({
  recipe,
  selected,
  compact = false,
  onSelect,
  favorite,
  onToggleFavorite,
}: {
  recipe: CraftingRecipe
  selected: boolean
  compact?: boolean
  onSelect: () => void
  favorite: boolean
  onToggleFavorite: () => void
}) {
  return (
    <article
      className={`flex overflow-hidden border bg-background/55 ${selected ? 'border-ember/70' : 'border-border/70'} ${compact ? 'min-h-32' : 'min-h-44'}`}
    >
      <div className="grid w-24 shrink-0 place-items-center border-r border-border/60 bg-[radial-gradient(circle,oklch(0.5_0.1_45/18%),transparent_65%)]">
        {recipe.station === 'ALCHEMY_TABLE' ? (
          <FlaskConical className="size-8 text-moss" />
        ) : (
          <Hammer className="size-8 text-ember" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[0.55rem] uppercase text-ember">
            {stationName(recipe.station)}
          </p>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={
              favorite
                ? 'Прибрати зі швидкого доступу'
                : 'Додати до швидкого доступу'
            }
            className="text-muted-foreground transition hover:text-ember"
          >
            <Star
              className={`size-4 ${favorite ? 'fill-ember text-ember' : ''}`}
            />
          </button>
        </div>
        <h3 className="mt-1 font-serif text-sm">{recipe.name}</h3>
        {!compact ? (
          <p className="mt-1 line-clamp-2 text-[0.65rem] leading-4 text-muted-foreground">
            {recipe.description}
          </p>
        ) : null}
        <ul className="mt-2 space-y-1 text-[0.62rem]">
          {recipe.ingredients.slice(0, compact ? 2 : 4).map((ingredient) => (
            <li
              key={ingredient.resourceType}
              className="flex justify-between gap-2"
            >
              <span className="truncate">{ingredient.name}</span>
              <span
                className={
                  ingredient.available >= ingredient.amount
                    ? 'font-mono text-moss'
                    : 'font-mono text-destructive'
                }
              >
                {ingredient.amount}/{ingredient.available}
              </span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={!recipe.affordable}
          onClick={onSelect}
          className="mt-auto h-7 rounded-sm text-[0.65rem]"
        >
          {selected
            ? 'Обрано'
            : recipe.affordable
              ? 'Обрати'
              : 'Бракує компонентів'}
        </Button>
      </div>
    </article>
  )
}

function stationName(station: CraftingStation): string {
  return {
    WORKSHOP: 'Майстерня',
    ALCHEMY_TABLE: 'Алхімічний стіл',
    FORGE: 'Кузня',
    RITUAL_CIRCLE: 'Ритуальне коло',
  }[station]
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Готово'
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) return `${hours}г ${minutes}хв`
  if (minutes > 0) return `${minutes}хв ${remainingSeconds}с`
  return `${remainingSeconds}с`
}

function formatCraftDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function executeCraftingQuery(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{
  myCrafting: CraftingState
  startCraft: CraftingState
  claimCraft: CraftingState
}> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json()) as {
    data?: {
      myCrafting: CraftingState
      startCraft: CraftingState
      claimCraft: CraftingState
    }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('CRAFTING_REQUEST_FAILED')
  return payload.data
}

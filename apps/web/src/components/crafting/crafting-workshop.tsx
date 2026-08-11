'use client'

import { ArrowLeft, FlaskConical, Hammer, PackageCheck } from 'lucide-react'
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

type CraftingStation = 'WORKSHOP' | 'ALCHEMY_TABLE' | 'FORGE' | 'RITUAL_CIRCLE'

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

export function CraftingWorkshop({ onBack }: { onBack: () => void }) {
  const [crafting, setCrafting] = useState<CraftingState | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void executeCraftingQuery(`{ myCrafting { ${craftingFields} } }`).then(
      (data) => setCrafting(data.myCrafting),
      () => setError('Не вдалося відкрити майстерню.'),
    )
  }, [])

  const hasActiveJobs =
    crafting?.jobs.some((job) => job.status === 'ACTIVE') ?? false

  useEffect(() => {
    if (!hasActiveJobs) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
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
  const selectedRecipe =
    crafting.recipes.find((recipe) => recipe.id === selectedRecipeId) ??
    crafting.recipes[0]
  const selectedQuantity = selectedRecipe
    ? (quantities[selectedRecipe.id] ?? 1)
    : 1
  const canCraftSelected =
    selectedRecipe?.ingredients.every(
      (ingredient) =>
        ingredient.available >= ingredient.amount * selectedQuantity,
    ) ?? false

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
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <GamePanel eyebrow="Робоче місце" title="Кузня формул">
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
                <div className="mt-4 grid grid-cols-[5rem_1fr] gap-2">
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
          >
            <div className="space-y-2">
              {visibleJobs.length ? (
                visibleJobs.map((job) => {
                  const remaining = Math.max(
                    0,
                    Math.ceil((Date.parse(job.completesAt) - now) / 1_000),
                  )
                  const ready = job.status === 'ACTIVE' && remaining === 0
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
          {crafting.recipes.slice(0, 4).map((recipe) => (
            <RecipeChoiceCard
              key={recipe.id}
              recipe={recipe}
              compact
              selected={recipe.id === selectedRecipe?.id}
              onSelect={() => setSelectedRecipeId(recipe.id)}
            />
          ))}
        </div>
      </GamePanel>

      <GamePanel
        id="known-recipes"
        eyebrow="Відомі знання"
        title="Книга рецептів"
      >
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {crafting.recipes.map((recipe) => (
            <RecipeChoiceCard
              key={recipe.id}
              recipe={recipe}
              selected={recipe.id === selectedRecipe?.id}
              onSelect={() => setSelectedRecipeId(recipe.id)}
            />
          ))}
        </div>
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
}: {
  recipe: CraftingRecipe
  selected: boolean
  compact?: boolean
  onSelect: () => void
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
        <p className="font-mono text-[0.55rem] uppercase text-ember">
          {stationName(recipe.station)}
        </p>
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

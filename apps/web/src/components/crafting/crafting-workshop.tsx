'use client'

import { ArrowLeft, FlaskConical, Hammer, PackageCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    outputType outputName outputAmount affordable stationAvailable
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
            Кодекс ремесел
          </p>
          <h2 className="mt-2 text-xl font-medium">Майстерня</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Кожна станція має власну чергу. Кузня не блокує алхімічний стіл, а
            майбутній довгий ритуал не зупинить звичайне ремесло.
          </p>
        </div>
        <p className="font-mono text-xs text-moss">
          Активні процеси:{' '}
          {crafting.jobs.filter((job) => job.status === 'ACTIVE').length}/4
        </p>
      </div>

      {visibleJobs.length > 0 ? (
        <div className="mt-6 grid gap-px bg-border/60 sm:grid-cols-2">
          {visibleJobs.map((job) => {
            const remaining = Math.max(
              0,
              Math.ceil((Date.parse(job.completesAt) - now) / 1_000),
            )
            const ready = job.status === 'ACTIVE' && remaining === 0
            return (
              <article key={job.id} className="bg-background/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.6rem] uppercase tracking-wider text-moss">
                      {stationName(job.station)}
                    </p>
                    <h3 className="mt-1 font-medium">{job.recipeName}</h3>
                  </div>
                  {ready ? (
                    <PackageCheck className="text-moss" aria-label="Готово" />
                  ) : (
                    <span className="font-mono text-xs text-ember">
                      {formatDuration(remaining)}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Результат: {job.outputAmount} × {job.outputName}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!ready || pendingId === job.id}
                  onClick={() => void claimCraft(job)}
                  className="mt-3 h-8 w-full rounded-sm"
                >
                  {pendingId === job.id
                    ? 'Отримуємо…'
                    : ready
                      ? 'Забрати результат'
                      : 'Створення триває'}
                </Button>
              </article>
            )
          })}
        </div>
      ) : null}

      <div className="mt-7 grid gap-px bg-border/60 lg:grid-cols-2">
        {crafting.recipes.map((recipe) => {
          const quantity = quantities[recipe.id] ?? 1
          const canAffordQuantity = recipe.ingredients.every(
            (ingredient) =>
              ingredient.available >= ingredient.amount * quantity,
          )
          return (
            <article key={recipe.id} className="bg-background/65 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
                    {stationName(recipe.station)}
                  </p>
                  <h3 className="mt-1 font-medium">{recipe.name}</h3>
                </div>
                {recipe.station === 'ALCHEMY_TABLE' ? (
                  <FlaskConical
                    className="shrink-0 text-moss"
                    aria-hidden="true"
                  />
                ) : (
                  <Hammer className="shrink-0 text-ember" aria-hidden="true" />
                )}
              </div>
              <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">
                {recipe.description}
              </p>
              <ul className="mt-4 space-y-2 text-xs">
                {recipe.ingredients.map((ingredient) => {
                  const required = ingredient.amount * quantity
                  const enough = ingredient.available >= required
                  return (
                    <li
                      key={ingredient.resourceType}
                      className="flex justify-between gap-4"
                    >
                      <span>{ingredient.name}</span>
                      <span
                        className={`font-mono ${enough ? 'text-moss' : 'text-destructive'}`}
                      >
                        {ingredient.available}/{required}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4 border-t border-border/70 pt-4 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Результат</span>
                  <span className="font-mono text-ember">
                    {recipe.outputAmount * quantity} × {recipe.outputName}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Час</span>
                  <span className="font-mono">
                    {formatDuration(recipe.durationSeconds * quantity)}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-[5rem_1fr] gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [recipe.id]: Math.min(
                        100,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    }))
                  }
                  aria-label={`Кількість для рецепта ${recipe.name}`}
                  className="h-9 rounded-sm font-mono"
                />
                <Button
                  type="button"
                  disabled={
                    pendingId !== null ||
                    !recipe.stationAvailable ||
                    !canAffordQuantity
                  }
                  onClick={() => void startCraft(recipe)}
                  className="h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
                >
                  {pendingId === recipe.id
                    ? 'Запускаємо…'
                    : !recipe.stationAvailable
                      ? 'Станція зайнята'
                      : !canAffordQuantity
                        ? 'Бракує компонентів'
                        : 'Почати створення'}
                </Button>
              </div>
            </article>
          )
        })}
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

'use client'

import { ArrowRight, Compass, Eye, Flame, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { BattleEncounter } from '@/components/world/battle-encounter'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

type Preparation = 'SEARCH_ARMORY' | 'INSPECT_TRACKS' | 'REST_BRAZIER'
type Location = 'BROKEN_WATCHPOST' | 'HOLLOW_ROAD' | 'CINDERHAVEN_GATE'

interface WorldState {
  currentLocation: Location
  preparationChoice: Preparation | null
  version: number
  routes: Array<{
    destination: Location
    locked: boolean
    lockReason: string | null
  }>
}

interface Hero {
  name: string
  archetype: 'VANGUARD' | 'RANGER' | 'ARCANIST'
  level: number
  baseStats: { health: number; damage: number; armor: number }
}

const preparations = [
  {
    value: 'SEARCH_ARMORY' as const,
    title: 'Обшукати пошкоджену зброярню',
    description:
      'Знайти вцілілі пластини й отримати тимчасовий захист у майбутній сутичці.',
    effect: 'Тимчасова броня',
    icon: Shield,
  },
  {
    value: 'INSPECT_TRACKS' as const,
    title: 'Дослідити сліди',
    description:
      'Прочитати рух істоти та заздалегідь побачити її перші два наміри.',
    effect: 'Розвідка намірів',
    icon: Eye,
  },
  {
    value: 'REST_BRAZIER' as const,
    title: 'Відпочити біля холодної жаровні',
    description: 'Відновити сили й підготувати короткий ефект регенерації.',
    effect: 'Повне відновлення',
    icon: Flame,
  },
]

export function GameJourney() {
  const [hero, setHero] = useState<Hero | null>(null)
  const [world, setWorld] = useState<WorldState | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadJourney().then((result) => {
      if (result.redirect) window.location.replace(result.redirect)
      else {
        setHero(result.hero)
        setWorld(result.world)
      }
    })
  }, [])

  async function prepare(choice: Preparation) {
    if (!world || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await executeWorldMutation(
        'mutation Prepare($input: PrepareLocationInput!) { performLocationAction(input: $input) { currentLocation preparationChoice version routes { destination locked lockReason } } }',
        {
          choice,
          expectedVersion: world.version,
          idempotencyKey: crypto.randomUUID(),
        },
        'performLocationAction',
      )
      setWorld(next)
    } catch {
      setError('Хроніка змінилася. Оновіть стан і повторіть дію.')
    } finally {
      setPending(false)
    }
  }

  async function travel() {
    if (!world || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await executeWorldMutation(
        'mutation Travel($input: TravelInput!) { travel(input: $input) { currentLocation preparationChoice version routes { destination locked lockReason } } }',
        {
          destination: 'HOLLOW_ROAD',
          expectedVersion: world.version,
          idempotencyKey: crypto.randomUUID(),
        },
        'travel',
      )
      setWorld(next)
    } catch {
      setError('Шлях не відкрився. Перевірте підготовку та спробуйте ще раз.')
    } finally {
      setPending(false)
    }
  }

  if (!hero || !world)
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <p className="font-mono text-sm uppercase tracking-[0.24em] text-moss">
          Хроніка відновлює шлях…
        </p>
      </main>
    )

  if (world.currentLocation === 'HOLLOW_ROAD')
    return <HollowRoad hero={hero} preparation={world.preparationChoice} />

  const hollowRoad = world.routes.find(
    (route) => route.destination === 'HOLLOW_ROAD',
  )

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[15rem_1fr]">
        <aside className="border-b border-border/70 bg-panel/55 p-6 lg:border-r lg:border-b-0 lg:p-8">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-moss">
            Особова справа
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {hero.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Рівень {hero.level} · {archetypeName(hero.archetype)}
          </p>
          <dl className="mt-7 grid grid-cols-3 gap-px bg-border/60">
            {[
              ['HP', hero.baseStats.health],
              ['DMG', hero.baseStats.damage],
              ['ARM', hero.baseStats.armor],
            ].map(([label, value]) => (
              <div key={label} className="bg-panel px-2 py-3 text-center">
                <dt className="font-mono text-[0.6rem] text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-sm text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 border-l border-ember/60 pl-4">
            <p className="text-xs uppercase tracking-widest text-ember">
              Поточне місце
            </p>
            <p className="mt-2 text-sm">Зламана застава</p>
          </div>
        </aside>

        <section className="relative overflow-hidden px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute top-0 right-0 h-72 w-72 bg-[radial-gradient(circle,rgba(174,90,47,0.12),transparent_68%)]" />
          <div className="relative max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-moss">
              Попелястий край · I
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Зламана застава
            </h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">
              Камінь ще тримає запах диму. Біля розбитої брами важкі сліди
              ведуть до Порожньої дороги, а в пилюці блищить край старої
              нагрудної пластини. Щось наближається — часу вистачить лише на
              одну підготовку.
            </p>

            <div className="mt-10">
              <div className="flex items-end justify-between gap-6 border-b border-border/70 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ember">
                    Рішення перед дорогою
                  </p>
                  <h3 className="mt-2 text-xl font-medium">Оберіть одну дію</h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  стан {world.version}
                </span>
              </div>

              <div className="grid gap-px bg-border/60 sm:grid-cols-3">
                {preparations.map((option) => {
                  const Icon = option.icon
                  const selected = world.preparationChoice === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={pending}
                      aria-pressed={selected}
                      onClick={() => prepare(option.value)}
                      className={`group min-h-52 bg-panel p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:cursor-wait ${selected ? 'bg-ember/10' : 'hover:bg-muted/45'}`}
                    >
                      <Icon
                        className={selected ? 'text-ember' : 'text-moss'}
                        size={20}
                        aria-hidden="true"
                      />
                      <span className="mt-8 block text-base font-medium leading-6">
                        {option.title}
                      </span>
                      <span className="mt-3 block text-sm leading-6 text-muted-foreground">
                        {option.description}
                      </span>
                      <span className="mt-5 block font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                        {selected ? 'Обрано · ' : ''}
                        {option.effect}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-6 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-4 border-t border-border/70 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Compass size={18} className="text-moss" aria-hidden="true" />
                <span>
                  {hollowRoad?.locked
                    ? hollowRoad.lockReason
                    : 'Шлях на Порожню дорогу готовий'}
                </span>
              </div>
              <Button
                type="button"
                disabled={pending || hollowRoad?.locked !== false}
                onClick={travel}
                className="h-12 rounded-sm bg-ember px-6 text-ink hover:bg-ember-bright"
              >
                Вирушити в дорогу
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function HollowRoad({
  hero,
  preparation,
}: {
  hero: Hero
  preparation: Preparation | null
}) {
  return (
    <BattleEncounter
      heroName={hero.name}
      preparation={preparationName(preparation)}
    />
  )
}

async function loadJourney(): Promise<{
  hero: Hero | null
  world: WorldState | null
  redirect: string | null
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ viewer { id } myCharacter { name archetype level baseStats { health damage armor } } currentLocation { currentLocation preparationChoice version routes { destination locked lockReason } } }',
      }),
    })
    const payload = (await response.json()) as {
      data?: {
        viewer?: unknown
        myCharacter?: Hero
        currentLocation?: WorldState
      }
      errors?: unknown
    }
    if (payload.errors || !payload.data?.viewer)
      return { hero: null, world: null, redirect: '/auth' }
    if (!payload.data.myCharacter)
      return { hero: null, world: null, redirect: '/character/create' }
    return {
      hero: payload.data.myCharacter,
      world: payload.data.currentLocation ?? null,
      redirect: null,
    }
  } catch {
    return { hero: null, world: null, redirect: '/auth' }
  }
}

async function executeWorldMutation(
  query: string,
  input: Record<string, unknown>,
  resultKey: 'performLocationAction' | 'travel',
): Promise<WorldState> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { input } }),
  })
  const payload = (await response.json()) as {
    data?: Partial<Record<typeof resultKey, WorldState>>
    errors?: unknown
  }
  const result = payload.data?.[resultKey]
  if (!response.ok || payload.errors || !result)
    throw new Error('WORLD_COMMAND_FAILED')
  return result
}

function archetypeName(value: Hero['archetype']): string {
  return { VANGUARD: 'Авангард', RANGER: 'Слідопит', ARCANIST: 'Арканіст' }[
    value
  ]
}

function preparationName(value: Preparation | null): string {
  if (!value) return 'Немає'
  return {
    SEARCH_ARMORY: 'Захисні пластини зі зброярні',
    INSPECT_TRACKS: 'Розвідка перших намірів ворога',
    REST_BRAZIER: 'Відновлення біля холодної жаровні',
  }[value]
}

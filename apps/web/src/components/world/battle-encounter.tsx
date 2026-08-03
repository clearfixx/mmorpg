'use client'

import { Swords } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const battleFields =
  'id status version turn hero { health maxHealth resource maxResource } enemy { health maxHealth } currentIntent { id name description } visibleIntents { id name description } actions { id name cost description } log'

interface Battle {
  id: string
  status: string
  version: number
  turn: number
  hero: {
    health: number
    maxHealth: number
    resource: number
    maxResource: number
  }
  enemy: { health: number; maxHealth: number }
  currentIntent: { id: string; name: string; description: string }
  visibleIntents: Array<{ id: string; name: string; description: string }>
  actions: Array<{
    id: string
    name: string
    cost: number
    description: string
  }>
  log: string[]
}

export function BattleEncounter({
  heroName,
  preparation,
}: {
  heroName: string
  preparation: string
}) {
  const [battle, setBattle] = useState<Battle | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void graphQl<{ activeBattle: Battle | null }>(
      `{ activeBattle { ${battleFields} } }`,
    )
      .then((data) => {
        setBattle(data.activeBattle)
        setLoading(false)
      })
      .catch(() => {
        setError('Не вдалося відновити стан бою.')
        setLoading(false)
      })
  }, [])

  async function start() {
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<{ startEncounter: Battle }>(
        `mutation Start($input: StartEncounterInput!) { startEncounter(input: $input) { ${battleFields} } }`,
        { input: { idempotencyKey: crypto.randomUUID() } },
      )
      setBattle(data.startEncounter)
    } catch {
      setError('Не вдалося розпочати сутичку.')
    } finally {
      setPending(false)
    }
  }

  async function act(actionId: string) {
    if (!battle) return
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<{ submitCombatCommand: Battle }>(
        `mutation Act($input: SubmitCombatCommandInput!) { submitCombatCommand(input: $input) { ${battleFields} } }`,
        {
          input: {
            actionId,
            expectedVersion: battle.version,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setBattle(data.submitCombatCommand)
    } catch {
      setError('Хід не виконано. Стан бою міг змінитися.')
    } finally {
      setPending(false)
    }
  }

  async function retreat() {
    if (!battle) return
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<{ retreatFromBattle: Battle }>(
        `mutation Retreat($input: RetreatInput!) { retreatFromBattle(input: $input) { ${battleFields} } }`,
        {
          input: {
            expectedVersion: battle.version,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setBattle(data.retreatFromBattle)
    } catch {
      setError('Відступ зараз неможливий.')
    } finally {
      setPending(false)
    }
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Відновлюємо поле бою…
      </main>
    )
  if (!battle)
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
        <section className="w-full max-w-2xl border border-border/70 bg-panel/75 p-7 sm:p-9">
          <div className="flex items-center gap-3 text-ember">
            <Swords size={18} />
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.25em]">
              Небезпечна місцевість
            </p>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
            Порожня дорога
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            {heroName} залишає мури застави. Між чорними валунами рухається
            постать із важким тесаком.
          </p>
          <div className="mt-6 border-l-2 border-moss bg-moss/5 px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-widest text-moss">
              Активна підготовка
            </p>
            <p className="mt-1 text-sm">{preparation}</p>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            onClick={start}
            disabled={pending}
            className="mt-6 h-10 rounded-sm bg-ember text-ink hover:bg-ember-bright"
          >
            {pending ? 'Мародер наближається…' : 'Прийняти бій'}
          </Button>
        </section>
      </main>
    )

  const finished = battle.status !== 'ACTIVE'
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl border border-border/70 bg-panel/60">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ember">
              Порожня дорога · хід {battle.turn}
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              Спотворений Завісою мародер
            </h1>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            стан {battle.version}
          </span>
        </header>
        <section className="grid gap-px bg-border/60 md:grid-cols-2">
          <HealthPanel
            title={heroName}
            value={battle.hero.health}
            max={battle.hero.maxHealth}
            secondary={`${battle.hero.resource}/${battle.hero.maxResource} ресурсу`}
          />
          <HealthPanel
            title="Мародер"
            value={battle.enemy.health}
            max={battle.enemy.maxHealth}
            secondary="важкий тесак"
          />
        </section>
        <section className="grid md:grid-cols-[1fr_18rem]">
          <div className="p-5 sm:p-6">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
              Намір ворога
            </p>
            <div className="mt-3 border-l-2 border-ember bg-ember/5 px-4 py-3">
              <p className="font-medium">{battle.currentIntent.name}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {battle.currentIntent.description}
              </p>
            </div>
            {battle.visibleIntents.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Далі: {battle.visibleIntents[1]?.name}
              </p>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {battle.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={
                    pending || finished || battle.hero.resource < action.cost
                  }
                  onClick={() => act(action.id)}
                  className="border border-border/70 bg-background/50 p-3 text-left transition hover:border-ember/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex justify-between gap-3 text-sm font-medium">
                    <span>{action.name}</span>
                    <span className="font-mono text-xs text-ember">
                      {action.cost}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <aside className="border-t border-border/70 bg-background/30 p-5 md:border-t-0 md:border-l">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Журнал бою
            </p>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
              {battle.log.map((entry, index) => (
                <li key={`${battle.version}-${index}`}>{entry}</li>
              ))}
            </ol>
            {!finished && battle.turn > 1 && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={retreat}
                className="mt-5 h-8 rounded-sm text-xs"
              >
                Відступити
              </Button>
            )}
            {finished && (
              <p
                className={`mt-6 border-l-2 px-3 py-2 text-sm ${battle.status === 'WON' ? 'border-moss text-moss' : 'border-destructive text-destructive'}`}
              >
                {battle.status === 'WON'
                  ? 'Перемога. Нагорода з’явиться в наступному пакеті.'
                  : 'Бій завершено.'}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-xs text-destructive">
                {error}
              </p>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}

function HealthPanel({
  title,
  value,
  max,
  secondary,
}: {
  title: string
  value: number
  max: number
  secondary: string
}) {
  const width = Math.max(0, Math.round((value / max) * 100))
  return (
    <div className="bg-panel p-5">
      <div className="flex justify-between text-sm">
        <span>{title}</span>
        <span className="font-mono">
          {value}/{max}
        </span>
      </div>
      <div className="mt-3 h-1.5 bg-background">
        <div
          className="h-full bg-ember transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{secondary}</p>
    </div>
  )
}

async function graphQl<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json()) as { data?: T; errors?: unknown }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('GRAPHQL_FAILED')
  return payload.data
}

'use client'

import { ArrowLeft, Shield, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

type Faction = 'DAWN_COVENANT' | 'ASHEN_HOST'

interface FactionState {
  faction: Faction | null
  characterVersion: number
  canChangeFaction: boolean
  dawnStrength: number
  ashenStrength: number
  contestedLocation: string
  controllingFaction: Faction
  frontLevelMin: number
  frontLevelMax: number
  nextScriptedShiftAt: string
}

const factionFields = `
  faction characterVersion canChangeFaction dawnStrength ashenStrength
  contestedLocation controllingFaction frontLevelMin frontLevelMax
  nextScriptedShiftAt
`

export function FactionFront({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<FactionState | null>(null)
  const [pending, setPending] = useState<Faction | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void factionQuery(`{ myFaction { ${factionFields} } }`, 'myFaction').then(
      setState,
      () => setError('Воєнна рада зараз недоступна.'),
    )
  }, [])

  async function choose(faction: Faction) {
    if (!state || pending) return
    setPending(faction)
    setError(null)
    try {
      setState(
        await factionQuery(
          `mutation Choose($input: ChooseFactionInput!) {
            chooseFaction(input: $input) { ${factionFields} }
          }`,
          'chooseFaction',
          {
            input: {
              faction,
              expectedCharacterVersion: state.characterVersion,
              idempotencyKey: crypto.randomUUID(),
            },
          },
        ),
      )
    } catch {
      setError('Присягу не прийнято. Оновіть стан і спробуйте ще раз.')
    } finally {
      setPending(null)
    }
  }

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
      {!state ? (
        <p className="text-sm text-muted-foreground">
          Писарі розгортають карту фронту…
        </p>
      ) : (
        <>
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
            Воєнна рада · рівні {state.frontLevelMin}–{state.frontLevelMax}
          </p>
          <h2 className="mt-2 text-xl font-medium">Присяга і стан фронту</h2>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
            Війна поки рухається серверними подіями. Живі герої згодом зможуть
            змінювати контроль локацій власними перемогами, не зустрічаючи на
            цьому фронті суперників іншого діапазону рівнів.
          </p>

          <div className="mt-6 grid gap-px bg-border/60 sm:grid-cols-2">
            <FactionCard
              faction="DAWN_COVENANT"
              title="Союз Світанку"
              description="Вартові старих міст, що прагнуть відновити порядок за Завісою."
              strength={state.dawnStrength}
              selected={state.faction === 'DAWN_COVENANT'}
              pending={pending === 'DAWN_COVENANT'}
              disabled={
                pending !== null ||
                state.faction === 'DAWN_COVENANT' ||
                (!state.canChangeFaction && state.faction !== null)
              }
              onChoose={() => void choose('DAWN_COVENANT')}
            />
            <FactionCard
              faction="ASHEN_HOST"
              title="Попелястий Легіон"
              description="Союз вигнанців, які вважають старий світ причиною катастрофи."
              strength={state.ashenStrength}
              selected={state.faction === 'ASHEN_HOST'}
              pending={pending === 'ASHEN_HOST'}
              disabled={
                pending !== null ||
                state.faction === 'ASHEN_HOST' ||
                (!state.canChangeFaction && state.faction !== null)
              }
              onChoose={() => void choose('ASHEN_HOST')}
            />
          </div>

          <div className="mt-5 border border-border/70 bg-background/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-moss">
                  Спірна територія
                </p>
                <p className="mt-1 font-medium">{state.contestedLocation}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Контроль: {factionName(state.controllingFaction)}
              </p>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden bg-border">
              <div
                className="bg-amber-300"
                style={{
                  width: `${(state.dawnStrength / (state.dawnStrength + state.ashenStrength)) * 100}%`,
                }}
              />
              <div className="flex-1 bg-red-900" />
            </div>
          </div>
          {state.faction ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Ви присягнули: {factionName(state.faction)}.{' '}
              {state.canChangeFaction
                ? 'Змінити сторону можна ще один раз.'
                : 'Право змінити сторону вже використано.'}
            </p>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function FactionCard({
  faction,
  title,
  description,
  strength,
  selected,
  pending,
  disabled,
  onChoose,
}: {
  faction: Faction
  title: string
  description: string
  strength: number
  selected: boolean
  pending: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const dawn = faction === 'DAWN_COVENANT'
  return (
    <article
      className={`p-5 ${dawn ? 'bg-amber-950/20' : 'bg-red-950/20'} ${selected ? 'ring-1 ring-inset ring-moss' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        {dawn ? (
          <Shield className="text-amber-300" aria-hidden="true" />
        ) : (
          <Swords className="text-red-400" aria-hidden="true" />
        )}
        <span className="font-mono text-xs">Сила: {strength}</span>
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      <Button
        type="button"
        variant={dawn ? 'outline' : 'default'}
        disabled={disabled}
        onClick={onChoose}
        className="mt-4 h-9 w-full rounded-sm"
      >
        {selected ? 'Ваша сторона' : pending ? 'Присяга…' : 'Присягнути'}
      </Button>
    </article>
  )
}

function factionName(faction: Faction) {
  return faction === 'DAWN_COVENANT' ? 'Союз Світанку' : 'Попелястий Легіон'
}

async function factionQuery(
  query: string,
  resultKey: 'myFaction' | 'chooseFaction',
  variables?: Record<string, unknown>,
): Promise<FactionState> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json()) as {
    data?: Partial<Record<typeof resultKey, FactionState>>
    errors?: unknown
  }
  const result = payload.data?.[resultKey]
  if (!response.ok || payload.errors || !result)
    throw new Error('FACTION_REQUEST_FAILED')
  return result
}

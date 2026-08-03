'use client'

import { Swords } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const battleFields =
  'id status phase encounterTier enemyName version turn hero { health maxHealth resource maxResource } enemy { health maxHealth } currentIntent { id name description } visibleIntents { id name description } actions { id name cost description } log { turn kind message amount detail }'

interface Battle {
  id: string
  status: string
  phase: string
  encounterTier: number
  enemyName: string
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
  log: Array<{
    turn: number
    kind: string
    message: string
    amount?: number
    detail?: string
  }>
}

interface BattleReward {
  claimId: string
  experience: number
  gold: number
  item: {
    id: string
    name: string
    itemLevel: number
    rarity: 'COMMON' | 'UNCOMMON'
    damage: number
    binding: string
    setName: string
  }
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
  const [reward, setReward] = useState<BattleReward | null>(null)

  useEffect(() => {
    void loadActiveBattle()
      .then(setBattle)
      .catch(() => setError('Не вдалося відновити стан бою.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (battle?.phase !== 'ENEMY_RESOLVING') return

    let cancelled = false
    const timer = window.setInterval(() => {
      void loadActiveBattle()
        .then((nextBattle) => {
          if (!cancelled && nextBattle) setBattle(nextBattle)
        })
        .catch(() => {
          if (!cancelled) setError('Не вдалося отримати відповідь ворога.')
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [battle?.phase, battle?.version])

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
    if (!battle || battle.phase !== 'PLAYER_TURN') return
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
    if (!battle || battle.phase !== 'PLAYER_TURN') return
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

  async function returnToWatchpost() {
    setPending(true)
    setError(null)
    try {
      await graphQl<{ returnToWatchpost: boolean }>(
        'mutation { returnToWatchpost }',
      )
      window.location.reload()
    } catch {
      setError('Не вдалося повернутися на заставу.')
      setPending(false)
    }
  }

  async function claimReward() {
    if (!battle || battle.status !== 'WON') return
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<{ claimBattleReward: BattleReward }>(
        `mutation Claim($input: ClaimBattleRewardInput!) {
          claimBattleReward(input: $input) {
            claimId experience gold
            item { id name itemLevel rarity damage binding setName }
          }
        }`,
        {
          input: {
            battleId: battle.id,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setReward(data.claimBattleReward)
    } catch {
      setError('Не вдалося отримати нагороду. Спробуйте ще раз.')
    } finally {
      setPending(false)
    }
  }

  async function continueAdventure() {
    if (!battle || !reward) return
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<{ continueAdventure: Battle }>(
        `mutation Continue($input: ContinueAdventureInput!) { continueAdventure(input: $input) { ${battleFields} } }`,
        {
          input: {
            battleId: battle.id,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setReward(null)
      setBattle(data.continueAdventure)
    } catch {
      setError(
        'Не вдалося продовжити пригоду. Оновіть стан і спробуйте ще раз.',
      )
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
              Активний бонус
            </p>
            <p className="mt-1 text-sm">{preparation}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {preparationEffect(preparation)}
            </p>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
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
  const enemyResponding = battle.phase === 'ENEMY_RESOLVING'
  const actionsLocked = pending || finished || enemyResponding

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl border border-border/70 bg-panel/60">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ember">
              Порожня дорога · хід {battle.turn}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{battle.enemyName}</h1>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            стан {battle.version}
          </span>
        </header>
        <section className="grid gap-px bg-border/60 md:grid-cols-2">
          <HealthPanel
            portrait="В"
            title={heroName}
            value={battle.hero.health}
            max={battle.hero.maxHealth}
            secondary={`${battle.hero.resource}/${battle.hero.maxResource} ресурсу`}
          />
          <HealthPanel
            portrait={battle.encounterTier > 1 ? 'Р' : 'М'}
            title={battle.encounterTier > 1 ? 'Розоритель' : 'Мародер'}
            value={battle.enemy.health}
            max={battle.enemy.maxHealth}
            secondary="важкий тесак"
          />
        </section>
        <section className="grid md:grid-cols-[1fr_18rem]">
          <div className="p-5 sm:p-6">
            {finished ? (
              <BattleResult
                status={battle.status}
                turns={battle.turn}
                health={battle.hero.health}
                maxHealth={battle.hero.maxHealth}
                pending={pending}
                reward={reward}
                onClaim={claimReward}
                onContinue={continueAdventure}
                onReturn={returnToWatchpost}
              />
            ) : enemyResponding ? (
              <div className="border-l-2 border-destructive bg-destructive/5 px-4 py-5">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-destructive">
                  Хід ворога
                </p>
                <p className="mt-2 font-medium">Мародер відповідає…</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Команду прийнято. Уміння заблоковані, доки сервер не завершить
                  відповідь ворога.
                </p>
              </div>
            ) : (
              <>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
                  Намір ворога
                </p>
                <div className="mt-3 border-l-2 border-ember bg-ember/5 px-4 py-3">
                  <p className="font-medium">{battle.currentIntent.name}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {battle.currentIntent.description}
                  </p>
                </div>
                {battle.visibleIntents.length > 1 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Далі: {battle.visibleIntents[1]?.name}
                  </p>
                ) : null}
              </>
            )}
            {!finished ? (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {battle.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={
                      actionsLocked || battle.hero.resource < action.cost
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
            ) : null}
            {error ? (
              <p
                role="alert"
                className="mt-5 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>
          <aside className="max-h-[34rem] overflow-y-auto border-t border-border/70 bg-background/30 p-5 md:border-t-0 md:border-l">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Журнал бою
            </p>
            <ol className="mt-3 space-y-3 text-xs leading-5">
              {battle.log.map((entry, index) => (
                <li
                  key={`${entry.turn}-${index}`}
                  className="border-b border-border/40 pb-2"
                >
                  <span className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                    Хід {entry.turn}
                  </span>
                  <span className={logColor(entry.kind)}>{entry.message}</span>
                  {typeof entry.amount === 'number' ? (
                    <span
                      className={`ml-2 font-mono ${entry.kind === 'HEAL' ? 'text-moss' : entry.kind === 'ENEMY_DAMAGE' ? 'text-destructive' : 'text-ember'}`}
                    >
                      [{entry.kind === 'HEAL' ? '+' : '−'}
                      {entry.amount} HP]
                    </span>
                  ) : null}
                  {entry.detail ? (
                    <span className="mt-1 block text-muted-foreground">
                      [{entry.detail}]
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {!finished && battle.turn > 1 ? (
              <Button
                type="button"
                variant="outline"
                disabled={actionsLocked}
                onClick={retreat}
                className="mt-5 h-8 rounded-sm text-xs"
              >
                Відступити
              </Button>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  )
}

function BattleResult({
  status,
  turns,
  health,
  maxHealth,
  pending,
  reward,
  onClaim,
  onContinue,
  onReturn,
}: {
  status: string
  turns: number
  health: number
  maxHealth: number
  pending: boolean
  reward: BattleReward | null
  onClaim: () => void
  onContinue: () => void
  onReturn: () => void
}) {
  const won = status === 'WON'
  return (
    <div
      className={`border-l-2 px-5 py-5 ${won ? 'border-moss bg-moss/5' : 'border-destructive bg-destructive/5'}`}
    >
      <p
        className={`font-mono text-[0.65rem] uppercase tracking-[0.2em] ${won ? 'text-moss' : 'text-destructive'}`}
      >
        Бій завершено
      </p>
      <h2 className="mt-2 text-2xl font-semibold">
        {won ? 'Перемога' : status === 'RETREATED' ? 'Відступ' : 'Поразка'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Ходів: {turns}. Здоров’я героя: {health}/{maxHealth}.
      </p>
      {won && !reward ? (
        <div className="mt-5 border border-ember/50 bg-background/50 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ember">
            Здобич не отримана
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Заберіть трофей мародера перед поверненням на заставу.
          </p>
          <Button
            type="button"
            onClick={onClaim}
            disabled={pending}
            className="mt-4 h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
          >
            {pending ? 'Перевіряємо здобич…' : 'Отримати нагороду'}
          </Button>
        </div>
      ) : null}
      {reward ? <RewardReveal reward={reward} /> : null}
      {!won || reward ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onReturn}
            disabled={pending}
            variant="outline"
            className="h-9 rounded-sm"
          >
            Повернутися на заставу
          </Button>
          {won && reward ? (
            <Button
              type="button"
              onClick={onContinue}
              disabled={pending}
              className="h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
            >
              {pending ? 'Шукаємо шлях…' : 'Продовжити пригоду'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RewardReveal({ reward }: { reward: BattleReward }) {
  return (
    <section
      className="mt-5 border border-moss/50 bg-background/55 p-4"
      aria-live="polite"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
        Нагороду отримано
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[5rem_1fr]">
        <div className="grid size-20 place-items-center border border-ember/50 bg-ember/5 font-mono text-2xl text-ember">
          V
        </div>
        <div>
          <p className="text-lg font-semibold">{reward.item.name}</p>
          <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-ember">
            {rarityName(reward.item.rarity)} · комплект {reward.item.setName}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-px bg-border/60 text-center">
            <RewardStat label="DMG" value={`+${reward.item.damage}`} />
            <RewardStat label="EXP" value={`+${reward.experience}`} />
            <RewardStat label="Золото" value={`+${reward.gold}`} />
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Предмет переміщено до постійного сундука. Він прив’яжеться до героя
            після екіпірування.
          </p>
        </div>
      </div>
    </section>
  )
}

function RewardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-2 py-2">
      <dt className="font-mono text-[0.55rem] uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}

function HealthPanel({
  portrait,
  title,
  value,
  max,
  secondary,
}: {
  portrait: string
  title: string
  value: number
  max: number
  secondary: string
}) {
  const width = Math.max(0, Math.round((value / max) * 100))
  return (
    <div className="flex gap-4 bg-panel p-5">
      <div
        className="grid size-16 shrink-0 place-items-center border border-border bg-background font-mono text-xl text-ember"
        aria-label={`Портрет: ${title}`}
      >
        {portrait}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-sm">
          <span className="truncate">{title}</span>
          <span className="font-mono">
            {value}/{max}
          </span>
        </div>
        <div className="mt-3 h-1.5 bg-background">
          <div className="h-full bg-ember" style={{ width: `${width}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{secondary}</p>
      </div>
    </div>
  )
}

function preparationEffect(preparation: string): string {
  if (preparation.includes('пластини'))
    return 'Кожна атака ворога завдає на 4 одиниці менше шкоди.'
  if (preparation.includes('намірів'))
    return 'Ви бачите поточний і наступний намір ворога.'
  return 'Перші три ходи відновлюють по 6 HP.'
}

function logColor(kind: string): string {
  if (kind === 'HEAL' || kind === 'VICTORY') return 'text-moss'
  if (kind === 'ENEMY_DAMAGE') return 'text-destructive'
  if (kind === 'PLAYER_DAMAGE') return 'text-ember'
  if (kind === 'DEFENSE' || kind === 'STATUS') return 'text-cyan-300'
  return 'text-muted-foreground'
}

async function loadActiveBattle(): Promise<Battle | null> {
  const data = await graphQl<{ latestBattle: Battle | null }>(
    `{ latestBattle { ${battleFields} } }`,
  )
  return data.latestBattle
}

function rarityName(rarity: BattleReward['item']['rarity']): string {
  return rarity === 'UNCOMMON' ? 'Незвичайний' : 'Звичайний'
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

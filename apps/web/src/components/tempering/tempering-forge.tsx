'use client'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Flame,
  Hammer,
  Shield,
  Sparkles,
  Sword,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  GameHeroBanner,
  GameMetric,
  GamePanel,
  gameUi,
} from '@/components/game-ui/game-dashboard'
import { Button } from '@/components/ui/button'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

interface TemperingItem {
  id: string
  name: string
  itemLevel: number
  rarity: string
  damage: number
  armor: number
  health: number
  temperingStage: number
  temperingProgress: number
  temperingVersion: number
}

interface TemperingPreview {
  itemId: string
  itemName: string
  itemVersion: number
  currentStage: number
  targetStage: number | null
  progressBasisPoints: number
  successChanceBasisPoints: number
  guaranteed: boolean
  eligible: boolean
  affordable: boolean
  durationSeconds: number
  accelerationPercent: number
  blockingReasons: string[]
  warnings: string[]
  costs: Array<{
    key: string
    required: number
    available: number
    sufficient: boolean
  }>
  stats: {
    currentDamage: number
    nextDamage: number
    damageDelta: number
    currentArmor: number
    nextArmor: number
    armorDelta: number
    currentHealth: number
    nextHealth: number
    healthDelta: number
  }
}

interface TemperingJob {
  id: string
  itemId: string
  itemVersion: number
  targetStage: number
  status: string
  startedAt: string
  readyAt: string
  remainingSeconds: number
  accelerationPercent: number
  canComplete: boolean
  canCancel: boolean
}

interface TemperingState {
  characterVersion: number
  queueCapacity: number
  queueAvailable: number
  jobs: TemperingJob[]
  preview: TemperingPreview | null
}

const temperingFields = `
  characterVersion queueCapacity queueAvailable
  jobs {
    id itemId itemVersion targetStage status startedAt readyAt remainingSeconds
    accelerationPercent canComplete canCancel
  }
  preview {
    itemId itemName itemVersion currentStage targetStage progressBasisPoints
    successChanceBasisPoints guaranteed eligible affordable durationSeconds
    accelerationPercent blockingReasons warnings
    costs { key required available sufficient }
    stats {
      currentDamage nextDamage damageDelta currentArmor nextArmor armorDelta
      currentHealth nextHealth healthDelta
    }
  }
`

export function TemperingForge({
  items,
  onBack,
  onChanged,
}: {
  items: TemperingItem[]
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const uniqueItems = useMemo(
    () => [...new Map(items.map((item) => [item.id, item])).values()],
    [items],
  )
  const [selectedItemId, setSelectedItemId] = useState(
    () => uniqueItems[0]?.id ?? null,
  )
  const [accelerationPercent, setAccelerationPercent] = useState(0)
  const [tempering, setTempering] = useState<TemperingState | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!selectedItemId) return
    let active = true
    const timer = window.setTimeout(() => {
      void queryTempering(
        `query Tempering($itemId: String, $acceleration: Int) {
          myTempering(itemId: $itemId, accelerationPercent: $acceleration) {
            ${temperingFields}
          }
        }`,
        { itemId: selectedItemId, acceleration: accelerationPercent },
      ).then(
        (data) => {
          if (active) {
            setTempering(data.myTempering)
            setError(null)
          }
        },
        () => {
          if (active)
            setError('Кузня не відповідає. Оновіть стан і спробуйте ще раз.')
        },
      )
    }, 150)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [selectedItemId, accelerationPercent])

  useEffect(() => {
    if (!tempering?.jobs.length) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [tempering?.jobs.length])

  async function startTempering() {
    const preview = tempering?.preview
    if (!preview || pending) return
    setPending(true)
    setError(null)
    try {
      const data = await queryTempering(
        `mutation Start($input: StartTemperingInput!) {
          startTempering(input: $input) { ${temperingFields} }
        }`,
        {
          input: {
            itemId: preview.itemId,
            accelerationPercent,
            expectedCharacterVersion: tempering.characterVersion,
            expectedItemVersion: preview.itemVersion,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setTempering(data.startTempering)
      await onChanged()
    } catch {
      setError('Не вдалося розпочати гартування. Стан або ресурси змінилися.')
    } finally {
      setPending(false)
    }
  }

  async function resolveTempering(
    job: TemperingJob,
    action: 'complete' | 'cancel',
  ) {
    if (!tempering || pending) return
    setPending(true)
    setError(null)
    try {
      const field =
        action === 'complete' ? 'completeTempering' : 'cancelTempering'
      const data = await queryTempering(
        `mutation Resolve($input: ResolveTemperingInput!) {
          ${field}(input: $input) { ${temperingFields} }
        }`,
        {
          input: {
            processId: job.id,
            expectedCharacterVersion: tempering.characterVersion,
            expectedItemVersion: job.itemVersion,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      )
      setTempering(data[field])
      await onChanged()
      if (selectedItemId) await refreshPreview(selectedItemId)
    } catch {
      setError(
        action === 'complete'
          ? 'Ритуал ще не завершився або його стан змінився.'
          : 'Процес уже неможливо скасувати. Оновіть чергу.',
      )
    } finally {
      setPending(false)
    }
  }

  async function refreshPreview(itemId: string) {
    const data = await queryTempering(
      `query Tempering($itemId: String, $acceleration: Int) {
        myTempering(itemId: $itemId, accelerationPercent: $acceleration) {
          ${temperingFields}
        }
      }`,
      { itemId, acceleration: accelerationPercent },
    )
    setTempering(data.myTempering)
  }

  const preview = tempering?.preview ?? null
  const selectedItem = uniqueItems.find((item) => item.id === selectedItemId)

  return (
    <div className={gameUi.pageGap}>
      <GameHeroBanner
        eyebrow="Попелястий Прихисток · висока кузня"
        title="Гартування спорядження"
        subtitle="Довгий шлях сили для найцінніших реліквій"
        description={
          <p>
            Майстри Завіси працюють тижнями й місяцями. Гарт потребує рідкісних
            каменів, золота та незворотних матеріалів, але значно підсилює саму
            річ. Черга працює паралельно зі звичайним ремеслом.
          </p>
        }
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-8 rounded-sm"
          >
            <ArrowLeft /> До майстерні
          </Button>
        }
        aside={
          <dl className="grid grid-cols-2 gap-px bg-border/60">
            <GameMetric
              label="Черга"
              value={`${tempering?.jobs.length ?? 0}/${tempering?.queueCapacity ?? 3}`}
            />
            <GameMetric
              label="Вільно"
              value={tempering?.queueAvailable ?? '—'}
            />
            <GameMetric label="Межа" value="XV" />
            <GameMetric label="Прискорення" value={`до 35%`} />
          </dl>
        }
      />

      {error ? (
        <div
          role="alert"
          className="border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <GamePanel eyebrow="Сховище" title="Оберіть реліквію">
          <div className="max-h-[42rem] space-y-1 overflow-y-auto pr-1">
            {uniqueItems.length ? (
              uniqueItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex w-full items-center gap-3 border p-2 text-left ${item.id === selectedItemId ? 'border-ember/70 bg-ember/10' : 'border-border/60 bg-background/50 hover:border-ember/40'}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center border border-border/60">
                    {item.damage >= item.armor ? (
                      <Sword className="size-4 text-ember" />
                    ) : (
                      <Shield className="size-4 text-ember" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{item.name}</span>
                    <span className="mt-1 block font-mono text-[0.52rem] uppercase text-muted-foreground">
                      {item.rarity} · {item.itemLevel} рів. · +
                      {item.temperingStage}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                У сховищі немає спорядження.
              </p>
            )}
          </div>
        </GamePanel>

        <GamePanel
          eyebrow="Ковадло Завіси"
          title={selectedItem?.name ?? 'Річ не обрана'}
        >
          {preview ? (
            <div className="space-y-3">
              <div className="grid gap-px bg-border/60 sm:grid-cols-4">
                <GameMetric
                  label="Поточний гарт"
                  value={`+${preview.currentStage}`}
                />
                <GameMetric
                  label="Наступний"
                  value={
                    preview.targetStage ? `+${preview.targetStage}` : 'Межа'
                  }
                />
                <GameMetric
                  label="Шанс"
                  value={
                    preview.guaranteed
                      ? 'Гарантовано'
                      : `${(preview.successChanceBasisPoints / 100).toFixed(1)}%`
                  }
                />
                <GameMetric
                  label="Час"
                  value={formatDuration(preview.durationSeconds)}
                />
              </div>

              <div className="grid place-items-center border border-ember/30 bg-[radial-gradient(circle,oklch(0.48_0.1_45/18%),transparent_62%)] py-8">
                <div className="grid size-24 place-items-center rounded-full border border-ember/55 bg-background/70">
                  <Hammer className="size-10 text-ember" />
                </div>
                <p className="mt-3 font-serif text-lg">{preview.itemName}</p>
                <p className="mt-1 font-mono text-[0.58rem] text-muted-foreground">
                  Накопичена гарантія:{' '}
                  {(preview.progressBasisPoints / 100).toFixed(0)}%
                </p>
              </div>

              <div className="grid gap-px bg-border/60 sm:grid-cols-3">
                <StatDelta
                  label="Шкода"
                  current={preview.stats.currentDamage}
                  next={preview.stats.nextDamage}
                  delta={preview.stats.damageDelta}
                />
                <StatDelta
                  label="Броня"
                  current={preview.stats.currentArmor}
                  next={preview.stats.nextArmor}
                  delta={preview.stats.armorDelta}
                />
                <StatDelta
                  label="Здоров’я"
                  current={preview.stats.currentHealth}
                  next={preview.stats.nextHealth}
                  delta={preview.stats.healthDelta}
                />
              </div>

              <div className="border border-border/70 bg-background/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="tempering-acceleration" className="text-xs">
                    Прискорення процесу
                  </label>
                  <span className="font-mono text-xs text-ember">
                    {accelerationPercent}%
                  </span>
                </div>
                <input
                  id="tempering-acceleration"
                  type="range"
                  min={0}
                  max={35}
                  step={5}
                  value={accelerationPercent}
                  onChange={(event) =>
                    setAccelerationPercent(Number(event.target.value))
                  }
                  className="mt-3 w-full accent-orange-500"
                />
                <p className="mt-2 text-[0.65rem] text-muted-foreground">
                  Прискорення скорочує час, але різко збільшує ціну ритуалу.
                </p>
              </div>

              {preview.blockingReasons.length || preview.warnings.length ? (
                <div className="border border-ember/35 bg-ember/5 p-3 text-xs">
                  {[...preview.blockingReasons, ...preview.warnings].map(
                    (message) => (
                      <p
                        key={message}
                        className="flex gap-2 text-muted-foreground"
                      >
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-ember" />
                        {message}
                      </p>
                    ),
                  )}
                </div>
              ) : null}

              <Button
                type="button"
                onClick={() => void startTempering()}
                disabled={
                  pending ||
                  !preview.eligible ||
                  !preview.affordable ||
                  !tempering?.queueAvailable
                }
                className="h-11 w-full rounded-sm"
              >
                <Flame /> Почати гартування до +
                {preview.targetStage ?? preview.currentStage}
              </Button>
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              Оберіть річ для розрахунку.
            </div>
          )}
        </GamePanel>

        <div className="space-y-2">
          <GamePanel eyebrow="Вартість" title="Ресурси ритуалу">
            {preview?.costs.length ? (
              <div className="space-y-1">
                {preview.costs.map((cost) => (
                  <div
                    key={cost.key}
                    className="flex items-center justify-between gap-3 border border-border/60 bg-background/50 p-2 text-xs"
                  >
                    <span>{costName(cost.key)}</span>
                    <span
                      className={`font-mono ${cost.sufficient ? 'text-moss' : 'text-destructive'}`}
                    >
                      {cost.available.toLocaleString('uk-UA')}/
                      {cost.required.toLocaleString('uk-UA')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Вартість з’явиться після вибору речі.
              </p>
            )}
          </GamePanel>

          <GamePanel eyebrow="Активні процеси" title="Черга майстрів">
            {tempering?.jobs.length ? (
              <div className="space-y-2">
                {tempering.jobs.map((job) => {
                  const remaining = Math.max(
                    0,
                    Math.ceil((new Date(job.readyAt).getTime() - now) / 1_000),
                  )
                  const ready = remaining === 0
                  return (
                    <article
                      key={job.id}
                      className="border border-border/70 bg-background/55 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs">Гарт до +{job.targetStage}</p>
                          <p className="mt-1 font-mono text-[0.55rem] text-muted-foreground">
                            {job.accelerationPercent}% прискорення
                          </p>
                        </div>
                        {ready ? (
                          <Check className="size-4 text-moss" />
                        ) : (
                          <Clock3 className="size-4 text-ember" />
                        )}
                      </div>
                      <p className="mt-3 font-mono text-sm">
                        {ready ? 'Готово' : formatDuration(remaining)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          disabled={pending || !ready}
                          onClick={() => void resolveTempering(job, 'complete')}
                          className="h-8 rounded-sm text-xs"
                        >
                          Завершити
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending || ready || !job.canCancel}
                          onClick={() => void resolveTempering(job, 'cancel')}
                          className="h-8 rounded-sm text-xs"
                        >
                          <X /> Скасувати
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Майстри вільні. Можна запустити до трьох процесів.
              </p>
            )}
          </GamePanel>

          <GamePanel eyebrow="Застереження" title="Ціна сили">
            <p className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-ember" />
              Скасування повертає лише частину Сталі Завіси. Камені, золото й
              рідкісні компоненти згорають.
            </p>
          </GamePanel>
        </div>
      </div>
    </div>
  )
}

function StatDelta({
  label,
  current,
  next,
  delta,
}: {
  label: string
  current: number
  next: number
  delta: number
}) {
  return (
    <div className="bg-background/70 p-3">
      <p className="font-mono text-[0.55rem] uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-sm">
        {current} → {next}
      </p>
      <p className="mt-1 text-xs text-moss">+{delta}</p>
    </div>
  )
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0 с'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days) return `${days} дн ${hours} год`
  if (hours) return `${hours} год ${minutes} хв`
  return `${minutes} хв`
}

function costName(key: string) {
  const names: Record<string, string> = {
    GOLD: 'Золото',
    DULL_STONE: 'Тьмяний камінь',
    WHOLE_STONE: 'Цілісний камінь',
    FLAWLESS_STONE: 'Бездоганний камінь',
    MYTHIC_STONE: 'Міфічний камінь',
    DIVINE_STONE: 'Божественний камінь',
    VEIL_STEEL: 'Сталь Завіси',
  }
  return names[key] ?? key.replaceAll('_', ' ')
}

async function queryTempering(
  query: string,
  variables: Record<string, unknown> = {},
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json()) as {
    data?: Record<string, TemperingState>
    errors?: Array<{ message: string }>
  }
  if (!response.ok || payload.errors?.length || !payload.data)
    throw new Error(payload.errors?.[0]?.message ?? 'Tempering request failed')
  return payload.data
}

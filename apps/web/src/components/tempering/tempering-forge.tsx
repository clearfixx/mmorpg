'use client'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Flame,
  Hammer,
  Search,
  Shield,
  Sparkles,
  Sword,
  X,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import {
  GameHeroBanner,
  GameMetric,
  GamePanel,
  gameUi,
} from '@/components/game-ui/game-dashboard'
import { Button } from '@/components/ui/button'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const ukDateTime = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

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
  binding?: string
}

interface TemperingCost {
  key: string
  required: number
  available: number
  sufficient: boolean
}

interface TemperingPreview {
  itemId: string
  itemName: string
  itemVersion: number
  currentStage: number
  currentStageName: string
  targetStage: number | null
  targetStageName: string | null
  ritualMilestone: string
  progressBasisPoints: number
  successChanceBasisPoints: number
  failureProgressBasisPoints: number
  failuresUntilGuarantee: number
  maximumAttemptsToAdvance: number
  currentStatBonusBasisPoints: number
  targetStatBonusBasisPoints: number
  guaranteed: boolean
  eligible: boolean
  affordable: boolean
  durationSeconds: number
  accelerationPercent: number
  blockingReasons: string[]
  warnings: string[]
  costs: TemperingCost[]
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
  itemName: string
  startingStage: number
  targetStage: number
  targetStageName: string
  ritualMilestone: string
  successChanceBasisPoints: number
  failureProgressBasisPoints: number
  guaranteedAttempt: boolean
  status: string
  startedAt: string
  readyAt: string
  remainingSeconds: number
  accelerationPercent: number
  canComplete: boolean
  canCancel: boolean
  progressPercent: number
  cancellationRefunds: TemperingCost[]
  cancellationLosses: TemperingCost[]
}

interface TemperingHistory {
  id: string
  itemId: string
  itemName: string
  startingStage: number
  targetStage: number
  targetStageName: string
  resultingStage: number
  resultingStageName: string
  status: string
  resultProgress: number | null
  guaranteed: boolean | null
  startedAt: string
  resolvedAt: string | null
}

interface TemperingRoadmap {
  fromStage: number
  toStage: number
  expectedAttempts: number
  maximumAttempts: number
  expectedDurationSeconds: number
  maximumDurationSeconds: number
  expectedCosts: TemperingCost[]
  maximumCosts: TemperingCost[]
  stages: Array<{
    stage: number
    name: string
    ritualMilestone: boolean
    cumulativeStatBonusBasisPoints: number
    successChanceBasisPoints: number
    failureProgressBasisPoints: number
    expectedAttempts: number
    maximumAttempts: number
    expectedDurationSeconds: number
    maximumDurationSeconds: number
  }>
}

interface TemperingState {
  characterVersion: number
  queueCapacity: number
  queueAvailable: number
  jobs: TemperingJob[]
  history: TemperingHistory[]
  roadmap: TemperingRoadmap | null
  investment: {
    completedAttempts: number
    successfulAttempts: number
    progressAttempts: number
    cancelledAttempts: number
    goldSpent: number
    spentResources: TemperingCost[]
  }
  preview: TemperingPreview | null
}

const temperingFields = `
  characterVersion queueCapacity queueAvailable
  jobs {
    id itemId itemVersion itemName startingStage targetStage targetStageName ritualMilestone
    successChanceBasisPoints failureProgressBasisPoints guaranteedAttempt status startedAt
    readyAt remainingSeconds accelerationPercent canComplete canCancel progressPercent
    cancellationRefunds { key required available sufficient }
    cancellationLosses { key required available sufficient }
  }
  history {
    id itemId itemName startingStage targetStage targetStageName resultingStage resultingStageName status resultProgress
    guaranteed startedAt resolvedAt
  }
  roadmap {
    fromStage toStage expectedAttempts maximumAttempts expectedDurationSeconds
    maximumDurationSeconds expectedCosts { key required available sufficient }
    maximumCosts { key required available sufficient }
    stages {
      stage name ritualMilestone cumulativeStatBonusBasisPoints successChanceBasisPoints
      failureProgressBasisPoints expectedAttempts maximumAttempts
      expectedDurationSeconds maximumDurationSeconds
    }
  }
  investment {
    completedAttempts successfulAttempts progressAttempts cancelledAttempts goldSpent
    spentResources { key required available sufficient }
  }
  preview {
    itemId itemName itemVersion currentStage currentStageName targetStage targetStageName ritualMilestone progressBasisPoints
    successChanceBasisPoints failureProgressBasisPoints failuresUntilGuarantee
    maximumAttemptsToAdvance currentStatBonusBasisPoints targetStatBonusBasisPoints
    guaranteed eligible affordable durationSeconds
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
  const [showEligibleOnly, setShowEligibleOnly] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [itemSort, setItemSort] = useState('stage')
  const deferredItemSearch = useDeferredValue(itemSearch)
  const [cancelJobId, setCancelJobId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<TemperingHistory | null>(null)

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

  useEffect(() => {
    let active = true
    const savedItemId = window.localStorage.getItem(
      'veilfall.tempering.item.v1',
    )
    if (savedItemId && uniqueItems.some((item) => item.id === savedItemId)) {
      window.queueMicrotask(() => {
        if (active) setSelectedItemId(savedItemId)
      })
    }
    return () => {
      active = false
    }
  }, [uniqueItems])

  useEffect(() => {
    if (!selectedItemId) return
    window.localStorage.setItem('veilfall.tempering.item.v1', selectedItemId)
  }, [selectedItemId])

  useEffect(() => {
    if (!selectedItemId || !tempering?.jobs.length) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      void queryTempering(
        `query Tempering($itemId: String, $acceleration: Int) {
          myTempering(itemId: $itemId, accelerationPercent: $acceleration) {
            ${temperingFields}
          }
        }`,
        { itemId: selectedItemId, acceleration: accelerationPercent },
      )
        .then((data) => setTempering(data.myTempering))
        .catch(() => undefined)
    }
    const timer = window.setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [selectedItemId, accelerationPercent, tempering?.jobs.length])

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
      if (action === 'complete') setLastResult(data[field].history[0] ?? null)
      setCancelJobId(null)
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
  const activeItemIds = new Set(tempering?.jobs.map((job) => job.itemId) ?? [])
  const readyCount =
    tempering?.jobs.filter((job) => new Date(job.readyAt).getTime() <= now)
      .length ?? 0
  const visibleItems = useMemo(() => {
    const query = deferredItemSearch.trim().toLocaleLowerCase('uk-UA')
    const eligible = (item: TemperingItem) =>
      item.itemLevel >= 50 &&
      ['LEGENDARY', 'MYTHIC', 'DIVINE'].includes(item.rarity) &&
      item.binding === 'BOUND' &&
      item.temperingStage < 15
    return [...uniqueItems]
      .filter(
        (item) =>
          (!showEligibleOnly || eligible(item)) &&
          (!query || item.name.toLocaleLowerCase('uk-UA').includes(query)),
      )
      .sort((left, right) => {
        if (itemSort === 'level') return right.itemLevel - left.itemLevel
        if (itemSort === 'name')
          return left.name.localeCompare(right.name, 'uk')
        if (itemSort === 'rarity')
          return rarityRank(right.rarity) - rarityRank(left.rarity)
        return right.temperingStage - left.temperingStage
      })
  }, [deferredItemSearch, itemSort, showEligibleOnly, uniqueItems])

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
            <GameMetric label="Готово" value={readyCount} />
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
      {lastResult ? (
        <TemperingResult
          result={lastResult}
          onDismiss={() => setLastResult(null)}
        />
      ) : null}

      <div className="grid gap-2 xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <GamePanel eyebrow="Сховище" title="Оберіть реліквію">
          <label className="mb-2 flex items-center gap-2 border border-border/60 bg-background/50 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <span className="sr-only">Пошук предмета</span>
            <input
              type="search"
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Пошук у скрині…"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
          <select
            aria-label="Сортування предметів"
            value={itemSort}
            onChange={(event) => setItemSort(event.target.value)}
            className="mb-2 h-9 w-full border border-border/60 bg-background/50 px-2 text-xs"
          >
            <option value="stage">За ступенем гарту</option>
            <option value="level">За рівнем предмета</option>
            <option value="rarity">За рідкістю</option>
            <option value="name">За назвою</option>
          </select>
          <label className="mb-2 flex items-center gap-2 border border-border/60 bg-background/50 p-2 text-[0.65rem] text-muted-foreground">
            <input
              type="checkbox"
              checked={showEligibleOnly}
              onChange={(event) => setShowEligibleOnly(event.target.checked)}
              className="accent-orange-500"
            />
            Лише потенційно придатні
          </label>
          <div className="max-h-[42rem] space-y-1 overflow-y-auto pr-1">
            {visibleItems.length ? (
              visibleItems.map((item) => (
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
                      {activeItemIds.has(item.id) ? ' · у роботі' : ''}
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
                  value={preview.currentStageName}
                />
                <GameMetric
                  label="Наступний"
                  value={preview.targetStageName ?? 'Межа'}
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
                  {preview.ritualMilestone} · накопичена гарантія:{' '}
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

              <div className="grid gap-px bg-border/60 sm:grid-cols-3">
                <GameMetric
                  label="Сила ступеня"
                  value={`+${(preview.targetStatBonusBasisPoints / 100).toFixed(0)}%`}
                />
                <GameMetric
                  label="Невдача дасть"
                  value={`+${(preview.failureProgressBasisPoints / 100).toFixed(0)}% гарантії`}
                />
                <GameMetric
                  label="Найгірший шлях"
                  value={`${preview.maximumAttemptsToAdvance} спроб`}
                />
              </div>

              <div className="border border-border/70 bg-background/45 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span>Прогрес до гарантованого гарту</span>
                  <span className="font-mono text-ember">
                    {(preview.progressBasisPoints / 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-border/70">
                  <div
                    className="h-full bg-ember"
                    style={{
                      width: `${Math.min(100, preview.progressBasisPoints / 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[0.65rem] text-muted-foreground">
                  {preview.guaranteed
                    ? 'Наступна завершена спроба гарантовано підвищить ступінь.'
                    : `До гарантованої спроби — не більше ${preview.failuresUntilGuarantee} невдач.`}
                </p>
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
                          <p className="text-xs">{job.itemName}</p>
                          <p className="mt-1 font-mono text-[0.55rem] text-muted-foreground">
                            +{job.startingStage} → {job.targetStageName} ·{' '}
                            {job.accelerationPercent}% прискорення
                          </p>
                          <p className="mt-1 text-[0.6rem] text-ember">
                            {job.ritualMilestone}
                          </p>
                          <p className="mt-1 text-[0.6rem] text-muted-foreground">
                            {job.guaranteedAttempt
                              ? 'Гарантований результат'
                              : `${(job.successChanceBasisPoints / 100).toFixed(0)}% успіху · +${(job.failureProgressBasisPoints / 100).toFixed(0)}% гарантії при невдачі`}
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
                      <div className="mt-2 h-1 overflow-hidden bg-border/70">
                        <div
                          className="h-full bg-ember"
                          style={{ width: `${job.progressPercent}%` }}
                        />
                      </div>
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
                          onClick={() => setCancelJobId(job.id)}
                          className="h-8 rounded-sm text-xs"
                        >
                          <X /> Скасувати
                        </Button>
                      </div>
                      {cancelJobId === job.id ? (
                        <div className="mt-3 border border-destructive/35 bg-destructive/5 p-2 text-[0.65rem]">
                          <p className="text-destructive">
                            Скасування незворотне. Ви втратите:
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {job.cancellationLosses
                              .map(
                                (cost) =>
                                  `${costName(cost.key)} × ${cost.required}`,
                              )
                              .join(' · ')}
                          </p>
                          <p className="mt-1 text-moss">
                            Повернеться:{' '}
                            {job.cancellationRefunds.length
                              ? job.cancellationRefunds
                                  .map(
                                    (cost) =>
                                      `${costName(cost.key)} × ${cost.required}`,
                                  )
                                  .join(' · ')
                              : 'нічого'}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              className="h-7 rounded-sm text-xs"
                              onClick={() =>
                                void resolveTempering(job, 'cancel')
                              }
                            >
                              Підтвердити
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-7 rounded-sm text-xs"
                              onClick={() => setCancelJobId(null)}
                            >
                              Залишити
                            </Button>
                          </div>
                        </div>
                      ) : null}
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
          <GamePanel eyebrow="Де шукати" title="Матеріали гарту">
            <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
              <li>Камені гарту — трофеї кланових босів відповідного рангу.</li>
              <li>Сталь Завіси — довгі ремісничі ланцюги Високої кузні.</li>
              <li>Попіл і серця — ритуальні боси та пізні регіони світу.</li>
            </ul>
          </GamePanel>
        </div>
      </div>
      {tempering?.roadmap ? (
        <TemperingRoadmapPanel roadmap={tempering.roadmap} />
      ) : null}
      {tempering ? (
        <TemperingHistoryPanel
          history={tempering.history}
          investment={tempering.investment}
        />
      ) : null}
    </div>
  )
}

function rarityRank(rarity: string) {
  return [
    'COMMON',
    'UNCOMMON',
    'RARE',
    'EPIC',
    'LEGENDARY',
    'MYTHIC',
    'DIVINE',
  ].indexOf(rarity)
}

function TemperingResult({
  result,
  onDismiss,
}: {
  result: TemperingHistory
  onDismiss: () => void
}) {
  const succeeded = result.status === 'SUCCEEDED'
  return (
    <section
      className={`flex items-center justify-between gap-4 border p-3 ${succeeded ? 'border-moss/50 bg-moss/10' : 'border-ember/50 bg-ember/10'}`}
    >
      <div>
        <p className="font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground">
          Результат гартування
        </p>
        <p className="mt-1 text-sm">
          {succeeded
            ? `${result.itemName} досяг ступеня «${result.resultingStageName}» (+${result.resultingStage}).`
            : `${result.itemName} витримав ритуал, але ступінь не підвищився.`}
        </p>
        {!succeeded && result.resultProgress ? (
          <p className="mt-1 text-xs text-ember">
            Гарантія наступної спроби: {result.resultProgress / 100}%
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onDismiss}
        className="h-8 rounded-sm"
      >
        Закрити
      </Button>
    </section>
  )
}

function TemperingRoadmapPanel({ roadmap }: { roadmap: TemperingRoadmap }) {
  return (
    <GamePanel
      eyebrow="Довгий шлях"
      title={`Прогноз від +${roadmap.fromStage} до +${roadmap.toStage}`}
      action={
        <span className="font-mono text-[0.6rem] text-muted-foreground">
          очікувано {roadmap.expectedAttempts} спроб
        </span>
      }
    >
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-x-auto">
          <div className="grid min-w-[48rem] grid-cols-5 gap-px bg-border/60">
            {roadmap.stages.map((stage) => (
              <article key={stage.stage} className="bg-background/70 p-3">
                <p className="font-serif text-lg text-ember">+{stage.stage}</p>
                <p className="truncate text-xs">{stage.name}</p>
                <p className="mt-1 font-mono text-[0.55rem] text-muted-foreground">
                  {(stage.successChanceBasisPoints / 100).toFixed(0)}% успіху
                </p>
                <p className="mt-1 font-mono text-[0.55rem] text-moss">
                  +{(stage.cumulativeStatBonusBasisPoints / 100).toFixed(0)}% до
                  характеристик
                </p>
                <p className="mt-3 text-xs">
                  ≈ {stage.expectedAttempts} спроб · до {stage.maximumAttempts}
                </p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  {formatDuration(stage.expectedDurationSeconds)} · до{' '}
                  {formatDuration(stage.maximumDurationSeconds)}
                </p>
                {stage.ritualMilestone ? (
                  <p className="mt-2 text-[0.6rem] uppercase text-ember">
                    Ритуальний рубіж
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
        <div className="border border-border/60 bg-background/55 p-3">
          <p className="font-mono text-[0.58rem] uppercase text-ember">
            Очікувана інвестиція
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Час: {formatDuration(roadmap.expectedDurationSeconds)} ·
            песимістично {formatDuration(roadmap.maximumDurationSeconds)}
          </p>
          <div className="mt-3 space-y-1">
            {roadmap.expectedCosts.map((cost) => (
              <p key={cost.key} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {costName(cost.key)}
                </span>
                <span className="font-mono">
                  {cost.required.toLocaleString('uk-UA')}
                </span>
              </p>
            ))}
          </div>
          <details className="mt-3 border-t border-border/60 pt-3 text-xs">
            <summary className="cursor-pointer text-ember">
              Максимальна інвестиція
            </summary>
            <div className="mt-2 space-y-1">
              {roadmap.maximumCosts.map((cost) => (
                <p key={cost.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {costName(cost.key)}
                  </span>
                  <span className="font-mono">
                    {cost.required.toLocaleString('uk-UA')}
                  </span>
                </p>
              ))}
            </div>
          </details>
        </div>
      </div>
    </GamePanel>
  )
}

function TemperingHistoryPanel({
  history,
  investment,
}: {
  history: TemperingHistory[]
  investment: TemperingState['investment']
}) {
  return (
    <GamePanel eyebrow="Літопис ковадла" title="Історія та інвестиції">
      <div className="grid gap-2 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-px bg-border/60">
          <GameMetric
            label="Спроб (останні 20)"
            value={investment.completedAttempts}
          />
          <GameMetric label="Успішних" value={investment.successfulAttempts} />
          <GameMetric label="Прогрес" value={investment.progressAttempts} />
          <GameMetric label="Скасовано" value={investment.cancelledAttempts} />
          <div className="col-span-2">
            <GameMetric
              label="Витрачено золота"
              value={investment.goldSpent.toLocaleString('uk-UA')}
            />
          </div>
          {investment.spentResources.slice(0, 4).map((cost) => (
            <GameMetric
              key={cost.key}
              label={`Витрачено: ${costName(cost.key)}`}
              value={cost.required.toLocaleString('uk-UA')}
            />
          ))}
        </dl>
        <div className="max-h-72 overflow-y-auto border border-border/60">
          {history.length ? (
            history.map((entry) => (
              <article
                key={entry.id}
                className="grid gap-2 border-b border-border/60 bg-background/50 p-3 text-xs last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_9rem]"
              >
                <div>
                  <p>{entry.itemName}</p>
                  <p className="mt-1 font-mono text-[0.55rem] text-muted-foreground">
                    +{entry.startingStage} → {entry.targetStageName}
                  </p>
                  <p className="mt-1 text-[0.6rem] text-muted-foreground">
                    Підсумок: {entry.resultingStageName} (+
                    {entry.resultingStage})
                    {entry.resultProgress
                      ? ` · гарантія ${entry.resultProgress / 100}%`
                      : ''}
                  </p>
                </div>
                <p className={historyStatusColor(entry.status)}>
                  {historyStatusName(entry.status)}
                </p>
                <time className="font-mono text-[0.58rem] text-muted-foreground">
                  {entry.resolvedAt
                    ? ukDateTime.format(new Date(entry.resolvedAt))
                    : '—'}
                </time>
              </article>
            ))
          ) : (
            <p className="p-4 text-xs text-muted-foreground">
              Ковадло ще не зберегло жодної завершеної спроби.
            </p>
          )}
        </div>
      </div>
    </GamePanel>
  )
}

function historyStatusName(status: string) {
  if (status === 'SUCCEEDED') return 'Ступінь здобуто'
  if (status === 'PROGRESS_GAINED') return 'Зросла гарантія'
  return 'Скасовано'
}

function historyStatusColor(status: string) {
  if (status === 'SUCCEEDED') return 'text-moss'
  if (status === 'PROGRESS_GAINED') return 'text-ember'
  return 'text-destructive'
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

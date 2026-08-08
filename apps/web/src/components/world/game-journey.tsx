'use client'

import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Eye,
  Flame,
  Package,
  Shield,
  Sword,
} from 'lucide-react'
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
  experience: number
  experienceIntoLevel: number
  experienceForNextLevel: number
  gold: number
  baseStats: { health: number; damage: number; armor: number }
}

interface InventoryItem {
  id: string
  name: string
  itemLevel: number
  rarity: string
  damage: number
  binding: string
  setName: string
  visualAssetId: string
}

interface Inventory {
  characterVersion: number
  baseDamage: number
  totalDamage: number
  chest: InventoryItem[]
  equipped: Array<{ slot: 'MAIN_HAND'; item: InventoryItem }>
  mainHandVisualAssetId: string | null
}

type TalentType = 'VITALITY' | 'POWER' | 'RESILIENCE'

interface TalentTree {
  characterVersion: number
  availablePoints: number
  talents: Array<{
    type: TalentType
    name: string
    description: string
    rank: number
    maxRank: number
    requiredLevel: number
    effectPerRank: number
    unlocked: boolean
  }>
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
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [talents, setTalents] = useState<TalentTree | null>(null)
  const [view, setView] = useState<'LOBBY' | 'EQUIPMENT'>('LOBBY')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadJourney().then((result) => {
      if (result.redirect) window.location.replace(result.redirect)
      else {
        setHero(result.hero)
        setWorld(result.world)
        setInventory(result.inventory)
        setTalents(result.talents)
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

  async function travel(destination: Location) {
    if (!world || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await executeWorldMutation(
        'mutation Travel($input: TravelInput!) { travel(input: $input) { currentLocation preparationChoice version routes { destination locked lockReason } } }',
        {
          destination,
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

  if (world.currentLocation === 'CINDERHAVEN_GATE')
    return (
      <CinderhavenGate
        hero={hero}
        inventory={inventory}
        talents={talents}
        pending={pending}
        error={error}
        onReturn={() => travel('BROKEN_WATCHPOST')}
        onUpgrade={async (type) => {
          if (!talents || pending) return
          setPending(true)
          setError(null)
          try {
            await executeTalentMutation(type, talents.characterVersion)
            const refreshed = await loadJourney()
            setHero(refreshed.hero)
            setWorld(refreshed.world)
            setInventory(refreshed.inventory)
            setTalents(refreshed.talents)
          } catch {
            setError(
              'Не вдалося розвинути талант. Оновіть стан і спробуйте ще раз.',
            )
          } finally {
            setPending(false)
          }
        }}
      />
    )

  if (view === 'EQUIPMENT' && inventory)
    return (
      <EquipmentScreen
        hero={hero}
        inventory={inventory}
        pending={pending}
        error={error}
        onBack={() => setView('LOBBY')}
        onEquip={async (itemId) => {
          setPending(true)
          setError(null)
          try {
            const next = await executeInventoryMutation(
              itemId,
              inventory.characterVersion,
            )
            setInventory(next)
            setHero({
              ...hero,
              baseStats: { ...hero.baseStats, damage: next.totalDamage },
            })
          } catch {
            setError(
              'Не вдалося екіпірувати предмет. Оновіть стан і повторіть дію.',
            )
          } finally {
            setPending(false)
          }
        }}
      />
    )

  const hollowRoad = world.routes.find(
    (route) => route.destination === 'HOLLOW_ROAD',
  )
  const cinderhaven = world.routes.find(
    (route) => route.destination === 'CINDERHAVEN_GATE',
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
          <div className="mt-5">
            <div className="flex justify-between font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              <span>Досвід</span>
              <span>
                {hero.experienceIntoLevel}/{hero.experienceForNextLevel}
              </span>
            </div>
            <div className="mt-2 h-1 bg-background">
              <div
                className="h-full bg-moss"
                style={{
                  width: `${Math.min(100, (hero.experienceIntoLevel / hero.experienceForNextLevel) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-ember">
              {hero.gold} золота
            </p>
          </div>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setView('EQUIPMENT')}
            className="mt-6 h-9 w-full justify-start rounded-sm"
          >
            <Package aria-hidden="true" />
            Герой і сундук
          </Button>
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
                onClick={() => travel('HOLLOW_ROAD')}
                className="h-12 rounded-sm bg-ember px-6 text-ink hover:bg-ember-bright"
              >
                Вирушити в дорогу
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-6 border border-border/70 bg-panel/55 p-5">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
                Наступний рубіж
              </p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-medium">
                    Ворота Попелястого Прихистку
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {cinderhaven?.locked
                      ? cinderhaven.lockReason
                      : 'Трофей довів вашу силу. Вартові відчинили шлях до міста.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || cinderhaven?.locked !== false}
                  onClick={() => travel('CINDERHAVEN_GATE')}
                  className="h-10 shrink-0 rounded-sm"
                >
                  Увійти до воріт <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function CinderhavenGate({
  hero,
  inventory,
  talents,
  pending,
  error,
  onReturn,
  onUpgrade,
}: {
  hero: Hero
  inventory: Inventory | null
  talents: TalentTree | null
  pending: boolean
  error: string | null
  onReturn: () => void
  onUpgrade: (type: TalentType) => void
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-4xl border border-border/70 bg-panel/60 p-6 sm:p-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-ember">
          Попелястий край · шлях завершено
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Ворота Попелястого Прихистку
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">
          Варта впізнає клинок із Порожньої дороги. Важкі стулки розходяться, і{' '}
          {hero.name} уперше бачить місто, де починається справжня боротьба за
          вплив, ремесла та місце серед майбутніх кланів.
        </p>
        <dl className="mt-8 grid gap-px bg-border/60 sm:grid-cols-4">
          <EndingStat label="Рівень" value={hero.level} />
          <EndingStat
            label="Сила"
            value={inventory?.totalDamage ?? hero.baseStats.damage}
          />
          <EndingStat label="Етап" value="I завершено" />
          <EndingStat
            label="До рівня"
            value={`${hero.experienceIntoLevel}/${hero.experienceForNextLevel} XP`}
          />
        </dl>
        <div className="mt-8 border-l-2 border-moss bg-moss/5 px-4 py-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-moss">
            Вертикальний зріз завершено
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Наступний пакет відкриє міський вузол і довготривалий розвиток
            героя.
          </p>
        </div>
        {talents ? (
          <section className="mt-8 border-t border-border/70 pt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                  Базові таланти
                </p>
                <h2 className="mt-2 text-xl font-medium">Розвиток героя</h2>
              </div>
              <span className="font-mono text-sm text-moss">
                Очки: {talents.availablePoints}
              </span>
            </div>
            <div className="mt-4 grid gap-px bg-border/60 sm:grid-cols-3">
              {talents.talents.map((talent) => (
                <div key={talent.type} className="bg-background/70 p-4">
                  <div className="flex justify-between gap-3">
                    <h3 className="font-medium">{talent.name}</h3>
                    <span className="font-mono text-xs text-ember">
                      {talent.rank}/{talent.maxRank}
                    </span>
                  </div>
                  <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {talent.description}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      pending ||
                      !talent.unlocked ||
                      talents.availablePoints < 1 ||
                      talent.rank >= talent.maxRank
                    }
                    onClick={() => onUpgrade(talent.type)}
                    className="mt-4 h-8 w-full rounded-sm"
                  >
                    {talent.unlocked
                      ? talent.rank >= talent.maxRank
                        ? 'Максимум'
                        : 'Підвищити ранг'
                      : `Рівень ${talent.requiredLevel}`}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-5 border-l-2 border-destructive px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onReturn}
          className="mt-7 h-10 rounded-sm"
        >
          <ArrowLeft aria-hidden="true" />
          Повернутися на заставу
        </Button>
      </section>
    </main>
  )
}

function EndingStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-background/70 p-4">
      <dt className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-base">{value}</dd>
    </div>
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

function EquipmentScreen({
  hero,
  inventory,
  pending,
  error,
  onBack,
  onEquip,
}: {
  hero: Hero
  inventory: Inventory
  pending: boolean
  error: string | null
  onBack: () => void
  onEquip: (itemId: string) => void
}) {
  const weapon = inventory.equipped.find(
    (entry) => entry.slot === 'MAIN_HAND',
  )?.item
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl border border-border/70 bg-panel/60">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ember">
              Зламана застава · спорядження
            </p>
            <h1 className="mt-1 text-xl font-semibold">{hero.name}</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-9 rounded-sm"
          >
            <ArrowLeft aria-hidden="true" /> До застави
          </Button>
        </header>
        <div className="grid lg:grid-cols-[18rem_1fr_20rem]">
          <aside className="border-b border-border/70 p-5 lg:border-r lg:border-b-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              Показники
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Базовий DMG</dt>
                <dd className="font-mono">{inventory.baseDamage}</dd>
              </div>
              <div className="flex justify-between text-ember">
                <dt>Зброя</dt>
                <dd className="font-mono">+{weapon?.damage ?? 0}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <dt>Загальний DMG</dt>
                <dd className="font-mono">{inventory.totalDamage}</dd>
              </div>
            </dl>
            <div className="mt-8">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Основна рука
              </p>
              <div className="mt-2 border border-ember/50 bg-ember/5 p-3 text-sm">
                {weapon ? weapon.name : 'Слот порожній'}
              </div>
            </div>
          </aside>
          <section className="relative min-h-[34rem] border-b border-border/70 p-6 lg:border-r lg:border-b-0">
            <p className="text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-moss">
              Динамічний вигляд
            </p>
            <div className="relative mx-auto mt-8 h-96 w-52">
              <div className="absolute top-0 left-1/2 h-16 w-14 -translate-x-1/2 border border-border bg-muted" />
              <div className="absolute top-16 left-1/2 h-44 w-28 -translate-x-1/2 border border-border bg-panel" />
              <div className="absolute top-60 left-1/2 h-32 w-24 -translate-x-1/2 border-x border-border bg-panel" />
              <div className="absolute top-20 right-0 flex h-56 w-10 items-center justify-center border border-ember/60 bg-ember/5 text-ember">
                {weapon ? (
                  <Sword className="h-7 w-7" aria-label={weapon.name} />
                ) : (
                  <span className="font-mono text-xs">—</span>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {inventory.mainHandVisualAssetId ?? 'Базовий вигляд без зброї'}
            </p>
          </section>
          <aside className="p-5">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Сундук · зброя
            </p>
            <div className="mt-4 space-y-3">
              {inventory.chest.length === 0 ? (
                <p className="border border-border/70 p-4 text-sm text-muted-foreground">
                  У сундуку немає доступної зброї.
                </p>
              ) : (
                inventory.chest.map((item) => (
                  <div
                    key={item.id}
                    className="border border-border/70 bg-background/45 p-4"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-ember">
                      {item.rarity} · {item.setName}
                    </p>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Зміна DMG</span>
                      <span
                        className={`font-mono ${deltaColor(item.damage - (weapon?.damage ?? 0))}`}
                      >
                        {formatDelta(item.damage - (weapon?.damage ?? 0))}
                      </span>
                    </div>
                    <Button
                      type="button"
                      disabled={pending || item.itemLevel > hero.level}
                      onClick={() => onEquip(item.id)}
                      className="mt-4 h-8 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
                    >
                      {pending ? 'Екіпіруємо…' : 'Взяти в основну руку'}
                    </Button>
                  </div>
                ))
              )}
            </div>
            {error ? (
              <p
                role="alert"
                className="mt-4 border-l-2 border-destructive px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  )
}

async function executeInventoryMutation(
  itemId: string,
  expectedCharacterVersion: number,
): Promise<Inventory> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Equip($input: EquipItemInput!) { equipItem(input: $input) { characterVersion baseDamage totalDamage mainHandVisualAssetId chest { id name itemLevel rarity damage binding setName visualAssetId } equipped { slot item { id name itemLevel rarity damage binding setName visualAssetId } } } }',
      variables: {
        input: {
          itemId,
          slot: 'MAIN_HAND',
          expectedCharacterVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { equipItem: Inventory }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('EQUIP_FAILED')
  return payload.data.equipItem
}

async function loadJourney(): Promise<{
  hero: Hero | null
  world: WorldState | null
  inventory: Inventory | null
  talents: TalentTree | null
  redirect: string | null
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ viewer { id } myCharacter { name archetype level experience experienceIntoLevel experienceForNextLevel gold baseStats { health damage armor } } currentLocation { currentLocation preparationChoice version routes { destination locked lockReason } } myInventory { characterVersion baseDamage totalDamage mainHandVisualAssetId chest { id name itemLevel rarity damage binding setName visualAssetId } equipped { slot item { id name itemLevel rarity damage binding setName visualAssetId } } } myTalents { characterVersion availablePoints talents { type name description rank maxRank requiredLevel effectPerRank unlocked } } }',
      }),
    })
    const payload = (await response.json()) as {
      data?: {
        viewer?: unknown
        myCharacter?: Hero
        currentLocation?: WorldState
        myInventory?: Inventory
        myTalents?: TalentTree
      }
      errors?: unknown
    }
    if (payload.errors || !payload.data?.viewer)
      return {
        hero: null,
        world: null,
        inventory: null,
        talents: null,
        redirect: '/auth',
      }
    if (!payload.data.myCharacter)
      return {
        hero: null,
        world: null,
        inventory: null,
        talents: null,
        redirect: '/character/create',
      }
    return {
      hero: payload.data.myCharacter,
      world: payload.data.currentLocation ?? null,
      inventory: payload.data.myInventory ?? null,
      talents: payload.data.myTalents ?? null,
      redirect: null,
    }
  } catch {
    return {
      hero: null,
      world: null,
      inventory: null,
      talents: null,
      redirect: '/auth',
    }
  }
}

async function executeTalentMutation(
  type: TalentType,
  expectedCharacterVersion: number,
): Promise<TalentTree> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Upgrade($input: UpgradeTalentInput!) { upgradeTalent(input: $input) { characterVersion availablePoints talents { type name description rank maxRank requiredLevel effectPerRank unlocked } } }',
      variables: {
        input: {
          type,
          expectedCharacterVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { upgradeTalent: TalentTree }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('TALENT_UPGRADE_FAILED')
  return payload.data.upgradeTalent
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

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

function deltaColor(value: number): string {
  if (value > 0) return 'text-moss'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

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
import { Input } from '@/components/ui/input'
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
  backpack: InventoryItem[]
  equipped: Array<{ slot: 'MAIN_HAND'; item: InventoryItem }>
  mainHandVisualAssetId: string | null
}

type TalentType = 'VITALITY' | 'POWER' | 'RESILIENCE'
type ResourceType = 'IRON' | 'COPPER' | 'BRONZE'

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
    costResource: ResourceType
    costAmount: number
    affordable: boolean
  }>
  resources: Array<{ type: ResourceType; amount: number }>
}

type ClanRole = 'LEADER' | 'ELDER' | 'MEMBER'

interface Clan {
  id: string
  name: string
  inviteCode: string
  level: number
  experience: number
  experienceIntoLevel: number
  experienceForNextLevel: number
  version: number
  characterVersion: number
  viewerRole: ClanRole
  members: Array<{
    characterId: string
    name: string
    level: number
    role: ClanRole
    joinedAt: string
    contribution: number
  }>
  treasury: Array<{ type: ResourceType; amount: number }>
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
  const [clan, setClan] = useState<Clan | null>(null)
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
        setClan(result.clan)
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

  if (view === 'EQUIPMENT' && inventory)
    return (
      <EquipmentScreen
        hero={hero}
        inventory={inventory}
        locationName={
          world.currentLocation === 'CINDERHAVEN_GATE'
            ? 'Попелястий Прихисток'
            : 'Зламана застава'
        }
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
            setTalents((current) =>
              current
                ? { ...current, characterVersion: next.characterVersion }
                : current,
            )
            setHero({
              ...hero,
              baseStats: { ...hero.baseStats, damage: next.totalDamage },
            })
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setHero(refreshed.hero)
              setWorld(refreshed.world)
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
              setClan(refreshed.clan)
            }
            setError('Не вдалося екіпірувати предмет. Стан героя вже оновлено.')
          } finally {
            setPending(false)
          }
        }}
      />
    )

  if (world.currentLocation === 'HOLLOW_ROAD')
    return <HollowRoad hero={hero} preparation={world.preparationChoice} />

  if (world.currentLocation === 'CINDERHAVEN_GATE')
    return (
      <CinderhavenGate
        hero={hero}
        inventory={inventory}
        talents={talents}
        clan={clan}
        pending={pending}
        error={error}
        onReturn={() => travel('BROKEN_WATCHPOST')}
        onOpenEquipment={() => setView('EQUIPMENT')}
        onCreateClan={async (name) => {
          if (!inventory || pending) return
          await runClanAction('CREATE', name, inventory.characterVersion)
        }}
        onJoinClan={async (inviteCode) => {
          if (!inventory || pending) return
          await runClanAction('JOIN', inviteCode, inventory.characterVersion)
        }}
        onContributeClan={async (resourceType, amount) => {
          if (!inventory || !clan || pending) return
          setPending(true)
          setError(null)
          try {
            const next = await executeClanContribution(
              resourceType,
              amount,
              inventory.characterVersion,
              clan.version,
            )
            setClan(next)
            setInventory({
              ...inventory,
              characterVersion: next.characterVersion,
            })
            setTalents((current) =>
              current
                ? {
                    ...current,
                    characterVersion: next.characterVersion,
                    resources: current.resources.map((resource) =>
                      resource.type === resourceType
                        ? { ...resource, amount: resource.amount - amount }
                        : resource,
                    ),
                  }
                : current,
            )
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setHero(refreshed.hero)
              setWorld(refreshed.world)
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
              setClan(refreshed.clan)
            }
            setError(
              'Внесок не прийнято. Перевірте залишок ресурсів і стан клану.',
            )
          } finally {
            setPending(false)
          }
        }}
        onUpgrade={async (type) => {
          if (!talents || pending) return
          setPending(true)
          setError(null)
          try {
            const next = await executeTalentMutation(
              type,
              talents.characterVersion,
            )
            setTalents(next)
            setInventory((current) =>
              current
                ? { ...current, characterVersion: next.characterVersion }
                : current,
            )
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setHero(refreshed.hero)
              setWorld(refreshed.world)
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
              setClan(refreshed.clan)
            }
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setHero(refreshed.hero)
              setWorld(refreshed.world)
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
              setClan(refreshed.clan)
            }
            setError(
              'Стан героя змінився. Дані оновлено — перевірте талант перед повторною дією.',
            )
          } finally {
            setPending(false)
          }
        }}
      />
    )

  async function runClanAction(
    action: 'CREATE' | 'JOIN',
    value: string,
    expectedCharacterVersion: number,
  ) {
    setPending(true)
    setError(null)
    try {
      const next = await executeClanMutation(
        action,
        value,
        expectedCharacterVersion,
      )
      setClan(next)
      setInventory((current) =>
        current
          ? { ...current, characterVersion: next.characterVersion }
          : current,
      )
      setTalents((current) =>
        current
          ? { ...current, characterVersion: next.characterVersion }
          : current,
      )
    } catch {
      const refreshed = await loadJourney()
      if (!refreshed.redirect) {
        setHero(refreshed.hero)
        setWorld(refreshed.world)
        setInventory(refreshed.inventory)
        setTalents(refreshed.talents)
        setClan(refreshed.clan)
      }
      setError(
        action === 'CREATE'
          ? 'Не вдалося заснувати клан. Перевірте назву та актуальний стан героя.'
          : 'Не вдалося вступити до клану. Перевірте код запрошення.',
      )
    } finally {
      setPending(false)
    }
  }

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
  clan,
  pending,
  error,
  onReturn,
  onOpenEquipment,
  onCreateClan,
  onJoinClan,
  onContributeClan,
  onUpgrade,
}: {
  hero: Hero
  inventory: Inventory | null
  talents: TalentTree | null
  clan: Clan | null
  pending: boolean
  error: string | null
  onReturn: () => void
  onOpenEquipment: () => void
  onCreateClan: (name: string) => Promise<void>
  onJoinClan: (inviteCode: string) => Promise<void>
  onContributeClan: (
    resourceType: ResourceType,
    amount: number,
  ) => Promise<void>
  onUpgrade: (type: TalentType) => void
}) {
  const [district, setDistrict] = useState<'HUB' | 'TRAINING' | 'CLAN'>('HUB')
  const [clanName, setClanName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-4xl border border-border/70 bg-panel/60 p-6 sm:p-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-ember">
          Попелястий край · міський вузол
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Попелястий Прихисток
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
        {district === 'HUB' ? (
          <section className="mt-8 border-t border-border/70 pt-7">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-moss">
              Міські квартали
            </p>
            <h2 className="mt-2 text-xl font-medium">Куди вирушити?</h2>
            <div className="mt-4 grid gap-px bg-border/60 sm:grid-cols-2">
              <CityDistrict
                icon={Shield}
                title="Зала гарту"
                description="Розподілити очки розвитку та посилити базові таланти героя."
                action="Увійти до зали"
                onClick={() => setDistrict('TRAINING')}
              />
              <CityDistrict
                icon={Package}
                title="Зброярня"
                description="Переглянути постійний сундук і змінити спорядження героя."
                action="Відкрити зброярню"
                onClick={onOpenEquipment}
              />
              <CityDistrict
                icon={Sword}
                title="Клановий двір"
                description="Місце формування кланів, спільних походів і боротьби з лігвами."
                action={clan ? 'Відкрити клан' : 'Знайти союзників'}
                onClick={() => setDistrict('CLAN')}
              />
              <CityDistrict
                icon={Compass}
                title="Торгові ряди"
                description="Безпечні угоди, вітрини гравців і майбутня ресурсна економіка."
                action="Ще зачинено"
                locked
              />
            </div>
          </section>
        ) : district === 'TRAINING' && talents ? (
          <section className="mt-8 border-t border-border/70 pt-7">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDistrict('HUB')}
              className="mb-5 h-8 rounded-sm px-2"
            >
              <ArrowLeft aria-hidden="true" /> До міських кварталів
            </Button>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                  Базові таланти
                </p>
                <h2 className="mt-2 text-xl font-medium">Розвиток героя</h2>
              </div>
              <div className="text-right font-mono text-xs">
                <p className="text-moss">Очки: {talents.availablePoints}</p>
                <p className="mt-1 text-muted-foreground">
                  {talents.resources
                    .map(
                      (resource) =>
                        `${resourceName(resource.type)}: ${resource.amount}`,
                    )
                    .join(' · ')}
                </p>
              </div>
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
                      !talent.affordable ||
                      talent.rank >= talent.maxRank
                    }
                    onClick={() => onUpgrade(talent.type)}
                    className="mt-4 h-8 w-full rounded-sm"
                  >
                    {talent.unlocked
                      ? talent.rank >= talent.maxRank
                        ? 'Максимум'
                        : `Підвищити · ${talent.costAmount} ${resourceName(talent.costResource)}`
                      : `Рівень ${talent.requiredLevel}`}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : district === 'CLAN' ? (
          <section className="mt-8 border-t border-border/70 pt-7">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDistrict('HUB')}
              className="mb-5 h-8 rounded-sm px-2"
            >
              <ArrowLeft aria-hidden="true" /> До міських кварталів
            </Button>
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
              Клановий двір
            </p>
            {clan ? (
              <ClanHall
                clan={clan}
                personalResources={talents?.resources ?? []}
                pending={pending}
                onContribute={onContributeClan}
              />
            ) : (
              <div className="mt-4 grid gap-px bg-border/60 sm:grid-cols-2">
                <form
                  className="bg-background/70 p-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void onCreateClan(clanName)
                  }}
                >
                  <h2 className="font-medium">Заснувати клан</h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Засновник стає головою клану. Назва має бути унікальною.
                  </p>
                  <Input
                    value={clanName}
                    onChange={(event) => setClanName(event.target.value)}
                    minLength={3}
                    maxLength={32}
                    placeholder="Назва клану"
                    aria-label="Назва нового клану"
                    className="mt-4 rounded-sm"
                  />
                  <Button
                    type="submit"
                    disabled={pending || clanName.trim().length < 3}
                    className="mt-3 h-9 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
                  >
                    {pending ? 'Записуємо статут…' : 'Заснувати клан'}
                  </Button>
                </form>
                <form
                  className="bg-background/70 p-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void onJoinClan(inviteCode.toUpperCase())
                  }}
                >
                  <h2 className="font-medium">Вступити за кодом</h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Отримайте восьмизначний код у голови або старости клану.
                  </p>
                  <Input
                    value={inviteCode}
                    onChange={(event) =>
                      setInviteCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-F0-9]/g, '')
                          .slice(0, 8),
                      )
                    }
                    minLength={8}
                    maxLength={8}
                    placeholder="A1B2C3D4"
                    aria-label="Код запрошення до клану"
                    className="mt-4 rounded-sm font-mono uppercase tracking-widest"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={pending || inviteCode.length !== 8}
                    className="mt-3 h-9 w-full rounded-sm"
                  >
                    {pending ? 'Перевіряємо код…' : 'Вступити до клану'}
                  </Button>
                </form>
              </div>
            )}
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

function CityDistrict({
  icon: Icon,
  title,
  description,
  action,
  locked = false,
  onClick,
}: {
  icon: typeof Shield
  title: string
  description: string
  action: string
  locked?: boolean
  onClick?: () => void
}) {
  return (
    <article className="bg-background/70 p-5">
      <Icon className={locked ? 'text-muted-foreground' : 'text-ember'} />
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={onClick}
        className="mt-4 h-8 w-full rounded-sm"
      >
        {action}
      </Button>
    </article>
  )
}

function ClanHall({
  clan,
  personalResources,
  pending,
  onContribute,
}: {
  clan: Clan
  personalResources: Array<{ type: ResourceType; amount: number }>
  pending: boolean
  onContribute: (resourceType: ResourceType, amount: number) => Promise<void>
}) {
  const [resourceType, setResourceType] = useState<ResourceType>('IRON')
  const [amount, setAmount] = useState(1)
  const personalBalance =
    personalResources.find((resource) => resource.type === resourceType)
      ?.amount ?? 0
  return (
    <div className="mt-4">
      <div className="grid gap-px bg-border/60 sm:grid-cols-3">
        <EndingStat label="Клан" value={clan.name} />
        <EndingStat label="Рівень" value={clan.level} />
        <EndingStat label="Досвід" value={clan.experience} />
      </div>
      <div className="mt-4 border-l-2 border-moss bg-moss/5 px-4 py-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-moss">
          Код запрошення
        </p>
        <p className="mt-2 font-mono text-lg tracking-[0.22em]">
          {clan.inviteCode}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Передавайте код лише тим героям, яких хочете бачити у складі.
        </p>
      </div>
      <section className="mt-6 border border-border/70 bg-background/45 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
              Кланова скарбниця
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {clan.treasury
                .map(
                  (resource) =>
                    `${resourceName(resource.type)}: ${resource.amount}`,
                )
                .join(' · ')}
            </p>
          </div>
          <p className="font-mono text-xs text-moss">
            {clan.experienceIntoLevel}/{clan.experienceForNextLevel} досвіду
          </p>
        </div>
        <div className="mt-3 h-1 bg-panel">
          <div
            className="h-full bg-moss"
            style={{
              width: `${Math.min(100, (clan.experienceIntoLevel / clan.experienceForNextLevel) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <div className="grid grid-cols-3 gap-px bg-border/60">
            {(['IRON', 'COPPER', 'BRONZE'] as ResourceType[]).map((type) => (
              <Button
                key={type}
                type="button"
                variant={resourceType === type ? 'default' : 'ghost'}
                onClick={() => setResourceType(type)}
                className="h-9 rounded-none"
              >
                {resourceName(type)}
              </Button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            max={Math.max(1, personalBalance)}
            value={amount}
            onChange={(event) =>
              setAmount(Math.max(1, Number(event.target.value)))
            }
            aria-label="Кількість ресурсів для клану"
            className="h-9 rounded-sm font-mono"
          />
          <Button
            type="button"
            disabled={pending || amount > personalBalance || amount < 1}
            onClick={() => void onContribute(resourceType, amount)}
            className="h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
          >
            {pending ? 'Передаємо…' : 'Зробити внесок'}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-destructive">
          Внесок безповоротний: передані особисті ресурси стають власністю
          клану. Особистий залишок: {personalBalance}.
        </p>
      </section>
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Склад клану</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {clan.members.length} учасн.
          </span>
        </div>
        <div className="mt-3 divide-y divide-border/70 border border-border/70">
          {clan.members.map((member) => (
            <div
              key={member.characterId}
              className="flex items-center justify-between gap-4 bg-background/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{member.name}</p>
                <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                  Рівень {member.level} · внесок {member.contribution}
                </p>
              </div>
              <span
                className={`font-mono text-[0.65rem] uppercase tracking-wider ${member.role === 'LEADER' ? 'text-ember' : 'text-moss'}`}
              >
                {clanRoleName(member.role)}
              </span>
            </div>
          ))}
        </div>
      </div>
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
  locationName,
  pending,
  error,
  onBack,
  onEquip,
}: {
  hero: Hero
  inventory: Inventory
  locationName: string
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
              {locationName} · спорядження
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
        'mutation Equip($input: EquipItemInput!) { equipItem(input: $input) { characterVersion baseDamage totalDamage mainHandVisualAssetId chest { id name itemLevel rarity damage binding setName visualAssetId } backpack { id name itemLevel rarity damage binding setName visualAssetId } equipped { slot item { id name itemLevel rarity damage binding setName visualAssetId } } } }',
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
  clan: Clan | null
  redirect: string | null
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ viewer { id } myCharacter { name archetype level experience experienceIntoLevel experienceForNextLevel gold baseStats { health damage armor } } currentLocation { currentLocation preparationChoice version routes { destination locked lockReason } } myInventory { characterVersion baseDamage totalDamage mainHandVisualAssetId chest { id name itemLevel rarity damage binding setName visualAssetId } backpack { id name itemLevel rarity damage binding setName visualAssetId } equipped { slot item { id name itemLevel rarity damage binding setName visualAssetId } } } myTalents { characterVersion availablePoints resources { type amount } talents { type name description rank maxRank requiredLevel effectPerRank unlocked costResource costAmount affordable } } myClan { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } members { characterId name level role joinedAt contribution } } }',
      }),
    })
    const payload = (await response.json()) as {
      data?: {
        viewer?: unknown
        myCharacter?: Hero
        currentLocation?: WorldState
        myInventory?: Inventory
        myTalents?: TalentTree
        myClan?: Clan | null
      }
      errors?: unknown
    }
    if (payload.errors || !payload.data?.viewer)
      return {
        hero: null,
        world: null,
        inventory: null,
        talents: null,
        clan: null,
        redirect: '/auth',
      }
    if (!payload.data.myCharacter)
      return {
        hero: null,
        world: null,
        inventory: null,
        talents: null,
        clan: null,
        redirect: '/character/create',
      }
    return {
      hero: payload.data.myCharacter,
      world: payload.data.currentLocation ?? null,
      inventory: payload.data.myInventory ?? null,
      talents: payload.data.myTalents ?? null,
      clan: payload.data.myClan ?? null,
      redirect: null,
    }
  } catch {
    return {
      hero: null,
      world: null,
      inventory: null,
      talents: null,
      clan: null,
      redirect: '/auth',
    }
  }
}

async function executeClanMutation(
  action: 'CREATE' | 'JOIN',
  value: string,
  expectedCharacterVersion: number,
): Promise<Clan> {
  const creating = action === 'CREATE'
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: creating
        ? 'mutation CreateClan($input: CreateClanInput!) { createClan(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } members { characterId name level role joinedAt contribution } } }'
        : 'mutation JoinClan($input: JoinClanInput!) { joinClan(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } members { characterId name level role joinedAt contribution } } }',
      variables: {
        input: {
          [creating ? 'name' : 'inviteCode']: value,
          expectedCharacterVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { createClan?: Clan; joinClan?: Clan }
    errors?: unknown
  }
  const clan = creating ? payload.data?.createClan : payload.data?.joinClan
  if (!response.ok || payload.errors || !clan) throw new Error('CLAN_FAILED')
  return clan
}

async function executeClanContribution(
  resourceType: ResourceType,
  amount: number,
  expectedCharacterVersion: number,
  expectedClanVersion: number,
): Promise<Clan> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Contribute($input: ContributeClanResourceInput!) { contributeClanResource(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } members { characterId name level role joinedAt contribution } } }',
      variables: {
        input: {
          resourceType,
          amount,
          expectedCharacterVersion,
          expectedClanVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { contributeClanResource: Clan }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('CLAN_CONTRIBUTION_FAILED')
  return payload.data.contributeClanResource
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
        'mutation Upgrade($input: UpgradeTalentInput!) { upgradeTalent(input: $input) { characterVersion availablePoints resources { type amount } talents { type name description rank maxRank requiredLevel effectPerRank unlocked costResource costAmount affordable } } }',
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

function resourceName(value: ResourceType): string {
  return { IRON: 'залізо', COPPER: 'мідь', BRONZE: 'бронза' }[value]
}

function archetypeName(value: Hero['archetype']): string {
  return { VANGUARD: 'Авангард', RANGER: 'Слідопит', ARCANIST: 'Арканіст' }[
    value
  ]
}

function clanRoleName(value: ClanRole): string {
  return { LEADER: 'Голова', ELDER: 'Староста', MEMBER: 'Учасник' }[value]
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

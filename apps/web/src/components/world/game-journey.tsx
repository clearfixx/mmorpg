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
  Swords,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CraftingWorkshop } from '@/components/crafting/crafting-workshop'
import { FactionFront } from '@/components/factions/faction-front'
import { GameShell, type GameSection } from '@/components/layout/game-shell'
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
  rollQuality: number
  damage: number
  armor: number
  health: number
  damageMin: number
  damageMax: number
  compatibleSlots: EquipmentSlotKey[]
  binding: string
  setName: string
  visualAssetId: string
}

type EquipmentSlotKey =
  | 'HEAD'
  | 'SHOULDERS'
  | 'CHEST'
  | 'BRACERS'
  | 'HANDS'
  | 'WAIST'
  | 'LEGS'
  | 'FEET'
  | 'MAIN_HAND'
  | 'OFF_HAND'
  | 'AMULET'
  | 'BRACELET'
  | 'RING_LEFT'
  | 'RING_RIGHT'

const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlotKey, string> = {
  HEAD: 'шолом',
  SHOULDERS: 'наплічники',
  CHEST: 'нагрудник',
  BRACERS: 'наручі',
  HANDS: 'рукавиці',
  WAIST: 'пояс',
  LEGS: 'штани',
  FEET: 'черевики',
  MAIN_HAND: 'основна рука',
  OFF_HAND: 'друга рука',
  AMULET: 'амулет',
  BRACELET: 'браслет',
  RING_LEFT: 'каблучка I',
  RING_RIGHT: 'каблучка II',
}

interface Inventory {
  characterVersion: number
  baseDamage: number
  totalDamage: number
  baseArmor: number
  totalArmor: number
  baseHealth: number
  totalHealth: number
  chest: InventoryItem[]
  backpack: InventoryItem[]
  equipped: Array<{ slot: EquipmentSlotKey; item: InventoryItem }>
  mainHandVisualAssetId: string | null
}

type TalentType =
  | 'VITALITY'
  | 'POWER'
  | 'RESILIENCE'
  | 'AWAKENED_VITALITY'
  | 'AWAKENED_POWER'
  | 'AWAKENED_RESILIENCE'
type ResourceType =
  | 'IRON'
  | 'COPPER'
  | 'BRONZE'
  | 'COAL'
  | 'TIMBER'
  | 'LEATHER'
  | 'HERBS'
  | 'OBSIDIAN_SHARD'
  | 'VEIL_STEEL'
  | 'STABILIZED_CATALYST'
  | 'VEIL_ECHO'
  | 'CURSED_HEART'
  | 'FALLEN_ELF_EYE'
  | 'DARK_PRIEST_ASH'

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
    advanced: boolean
    unlocked: boolean
    costResource: ResourceType
    costAmount: number
    affordable: boolean
  }>
  resources: Array<{ type: ResourceType; amount: number }>
}

type ClanRole = 'LEADER' | 'ELDER' | 'MEMBER'
type ClanDevelopmentBranch =
  'MILITARY' | 'HUNTING' | 'CRAFTING' | 'ECONOMIC' | 'MYSTIC'

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
  developments: Array<{
    branch: ClanDevelopmentBranch
    name: string
    description: string
    rank: number
    maxRank: number
    requiredClanLevel: number
    costResource: ResourceType
    costAmount: number
    affordable: boolean
    unlocked: boolean
  }>
}

interface ClanBoss {
  id: string
  name: string
  tier: number
  status: 'ACTIVE' | 'WON' | 'EXPIRED'
  maxHealth: number
  currentHealth: number
  version: number
  canSummon: boolean
  nextTier: number
  nextMaxHealth: number
  summonLockedReason: string | null
  viewerEligibleForReward: boolean
  viewerRewardClaimed: boolean
  viewerCanAttack: boolean
  viewerCurrentHealth: number
  viewerMaxHealth: number
  rewardType: ResourceType
  rewardAmount: number
  participants: Array<{
    characterId: string
    name: string
    damage: number
    actions: number
    maxHealth: number
    currentHealth: number
    defeated: boolean
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

const availableGameSections: readonly GameSection[] = [
  'LOBBY',
  'CHARACTER',
  'INVENTORY',
  'CRAFTING',
  'CLAN',
  'MAP',
]

type JourneyView =
  'LOBBY' | 'PROFILE' | 'INVENTORY' | 'CRAFTING' | 'CLAN' | 'FRONT'

type CityDistrictKey = 'HUB' | 'TRAINING' | 'CRAFTING' | 'FRONT' | 'CLAN'

function locationName(location: Location) {
  if (location === 'CINDERHAVEN_GATE') return 'Попелястий Прихисток'
  if (location === 'HOLLOW_ROAD') return 'Порожня дорога'
  return 'Зламана застава'
}

function JourneyShell({
  hero,
  inventory,
  talents,
  clan,
  activeSection,
  location,
  availableSections,
  onNavigate,
  children,
}: {
  hero: Hero
  inventory: Inventory | null
  talents: TalentTree | null
  clan: Clan | null
  activeSection: GameSection
  location: Location
  availableSections?: readonly GameSection[]
  onNavigate: (section: GameSection) => void
  children: ReactNode
}) {
  return (
    <GameShell
      hero={{
        name: hero.name,
        level: hero.level,
        archetype: hero.archetype,
        experienceIntoLevel: hero.experienceIntoLevel,
        experienceForNextLevel: hero.experienceForNextLevel,
        health: inventory?.totalHealth ?? hero.baseStats.health,
        damage: inventory?.totalDamage ?? hero.baseStats.damage,
        armor: inventory?.totalArmor ?? hero.baseStats.armor,
        gold: hero.gold,
      }}
      clanName={clan?.name ?? null}
      activeSection={activeSection}
      locationName={locationName(location)}
      availableSections={
        availableSections ??
        (location === 'CINDERHAVEN_GATE' ? undefined : availableGameSections)
      }
      resourceTotal={
        talents?.resources.reduce(
          (total, resource) => total + resource.amount,
          0,
        ) ?? 0
      }
      onNavigate={onNavigate}
    >
      {children}
    </GameShell>
  )
}

export function GameJourney() {
  const [hero, setHero] = useState<Hero | null>(null)
  const [world, setWorld] = useState<WorldState | null>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [talents, setTalents] = useState<TalentTree | null>(null)
  const [clan, setClan] = useState<Clan | null>(null)
  const [clanBoss, setClanBoss] = useState<ClanBoss | null>(null)
  const [view, setView] = useState<JourneyView>('LOBBY')
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
        setClanBoss(result.clanBoss)
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

  function navigate(section: GameSection) {
    if (section === 'LOBBY') setView('LOBBY')
    if (section === 'CHARACTER') setView('PROFILE')
    if (section === 'INVENTORY') setView('INVENTORY')
    if (section === 'CRAFTING') setView('CRAFTING')
    if (section === 'CLAN') setView('CLAN')
    if (section === 'MAP') setView('FRONT')
  }

  if (!hero || !world)
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <p className="font-mono text-sm uppercase tracking-[0.24em] text-moss">
          Хроніка відновлює шлях…
        </p>
      </main>
    )

  if ((view === 'PROFILE' || view === 'INVENTORY') && inventory)
    return (
      <JourneyShell
        hero={hero}
        inventory={inventory}
        talents={talents}
        clan={clan}
        activeSection={view === 'PROFILE' ? 'CHARACTER' : 'INVENTORY'}
        location={world.currentLocation}
        availableSections={availableGameSections}
        onNavigate={navigate}
      >
        <EquipmentScreen
          mode={view}
          hero={hero}
          inventory={inventory}
          talents={talents}
          clan={clan}
          locationName={locationName(world.currentLocation)}
          pending={pending}
          error={error}
          onBack={() => setView('LOBBY')}
          onEquip={async (itemId, slot) => {
            setPending(true)
            setError(null)
            try {
              const next = await executeInventoryMutation(
                itemId,
                slot,
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
                baseStats: {
                  health: next.totalHealth,
                  damage: next.totalDamage,
                  armor: next.totalArmor,
                },
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
              setError(
                'Не вдалося екіпірувати предмет. Стан героя вже оновлено.',
              )
            } finally {
              setPending(false)
            }
          }}
        />
      </JourneyShell>
    )

  if (world.currentLocation === 'HOLLOW_ROAD' && view === 'LOBBY')
    return (
      <JourneyShell
        hero={hero}
        inventory={inventory}
        talents={talents}
        clan={clan}
        activeSection="LOBBY"
        location={world.currentLocation}
        onNavigate={navigate}
      >
        <HollowRoad hero={hero} preparation={world.preparationChoice} />
      </JourneyShell>
    )

  if (
    world.currentLocation === 'CINDERHAVEN_GATE' ||
    view === 'CRAFTING' ||
    view === 'CLAN' ||
    view === 'FRONT'
  )
    return (
      <CinderhavenGate
        hero={hero}
        inventory={inventory}
        talents={talents}
        clan={clan}
        clanBoss={clanBoss}
        pending={pending}
        error={error}
        initialDistrict={
          view === 'CRAFTING'
            ? 'CRAFTING'
            : view === 'CLAN'
              ? 'CLAN'
              : view === 'FRONT'
                ? 'FRONT'
                : 'HUB'
        }
        onReturn={() => travel('BROKEN_WATCHPOST')}
        onOpenProfile={() => setView('PROFILE')}
        onOpenEquipment={() => setView('INVENTORY')}
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
        onUpgradeClanDevelopment={async (branch) => {
          if (!clan || pending) return
          setPending(true)
          setError(null)
          try {
            setClan(await executeClanDevelopment(branch, clan.version))
            const refreshed = await loadJourney()
            if (!refreshed.redirect) setClanBoss(refreshed.clanBoss)
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
              'Розвиток не завершено. Перевірте повноваження, рівень і скарбницю клану.',
            )
          } finally {
            setPending(false)
          }
        }}
        onSummonClanBoss={async () => {
          if (!clan || pending) return
          setPending(true)
          setError(null)
          try {
            const result = await executeClanBossMutation('SUMMON', {
              expectedClanVersion: clan.version,
              idempotencyKey: crypto.randomUUID(),
            })
            setClanBoss(result)
            setClan({ ...clan, version: clan.version + 1 })
          } catch {
            setError('Не вдалося викликати кланового боса.')
          } finally {
            setPending(false)
          }
        }}
        onAttackClanBoss={async () => {
          if (!clanBoss || pending) return
          setPending(true)
          setError(null)
          try {
            setClanBoss(
              await executeClanBossMutation('ATTACK', {
                encounterId: clanBoss.id,
                expectedVersion: clanBoss.version,
                idempotencyKey: crypto.randomUUID(),
              }),
            )
          } catch {
            const refreshed = await loadJourney()
            setClanBoss(refreshed.clanBoss)
            setError('Стан лігва змінився. Дані оновлено.')
          } finally {
            setPending(false)
          }
        }}
        onClaimClanBossReward={async () => {
          if (!clanBoss || pending) return
          setPending(true)
          setError(null)
          try {
            setClanBoss(await executeClanBossRewardMutation(clanBoss.id))
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
            }
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) {
              setClanBoss(refreshed.clanBoss)
              setInventory(refreshed.inventory)
              setTalents(refreshed.talents)
            }
            setError('Не вдалося отримати нагороду. Стан лігва оновлено.')
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
    <JourneyShell
      hero={hero}
      inventory={inventory}
      talents={talents}
      clan={clan}
      activeSection="LOBBY"
      location={world.currentLocation}
      onNavigate={navigate}
    >
      <div className="mx-auto grid w-full max-w-6xl border border-border/70 bg-background/75 lg:grid-cols-[15rem_1fr]">
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
              ['HP', inventory?.totalHealth ?? hero.baseStats.health],
              ['DMG', inventory?.totalDamage ?? hero.baseStats.damage],
              ['ARM', inventory?.totalArmor ?? hero.baseStats.armor],
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
            onClick={() => setView('INVENTORY')}
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
    </JourneyShell>
  )
}

function CinderhavenGate({
  hero,
  inventory,
  talents,
  clan,
  clanBoss,
  pending,
  error,
  initialDistrict,
  onReturn,
  onOpenProfile,
  onOpenEquipment,
  onCreateClan,
  onJoinClan,
  onContributeClan,
  onUpgradeClanDevelopment,
  onSummonClanBoss,
  onAttackClanBoss,
  onClaimClanBossReward,
  onUpgrade,
}: {
  hero: Hero
  inventory: Inventory | null
  talents: TalentTree | null
  clan: Clan | null
  clanBoss: ClanBoss | null
  pending: boolean
  error: string | null
  initialDistrict: CityDistrictKey
  onReturn: () => void
  onOpenProfile: () => void
  onOpenEquipment: () => void
  onCreateClan: (name: string) => Promise<void>
  onJoinClan: (inviteCode: string) => Promise<void>
  onContributeClan: (
    resourceType: ResourceType,
    amount: number,
  ) => Promise<void>
  onUpgradeClanDevelopment: (branch: ClanDevelopmentBranch) => Promise<void>
  onSummonClanBoss: () => Promise<void>
  onAttackClanBoss: () => Promise<void>
  onClaimClanBossReward: () => Promise<void>
  onUpgrade: (type: TalentType) => void
}) {
  const [district, setDistrict] = useState<CityDistrictKey>(initialDistrict)
  const [clanName, setClanName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const activeSection: GameSection = {
    HUB: 'LOBBY',
    TRAINING: 'CHARACTER',
    CRAFTING: 'CRAFTING',
    FRONT: 'MAP',
    CLAN: 'CLAN',
  }[district] as GameSection

  function navigate(section: GameSection) {
    if (section === 'INVENTORY') return onOpenEquipment()
    if (section === 'CHARACTER') return onOpenProfile()
    if (section === 'LOBBY') return setDistrict('HUB')
    if (section === 'CRAFTING') return setDistrict('CRAFTING')
    if (section === 'CLAN') return setDistrict('CLAN')
    if (section === 'MAP') return setDistrict('FRONT')
  }

  return (
    <JourneyShell
      hero={hero}
      inventory={inventory}
      talents={talents}
      clan={clan}
      activeSection={activeSection}
      location="CINDERHAVEN_GATE"
      onNavigate={navigate}
    >
      <section className="mx-auto w-full max-w-6xl border border-border/70 bg-panel/80 p-5 shadow-2xl shadow-black/25 sm:p-7">
        {district === 'HUB' ? (
          <>
            <section className="relative overflow-hidden border border-border/70 bg-background/70 px-6 py-8 sm:px-9">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,oklch(0.48_0.09_45/18%),transparent_38%)]" />
              <div className="relative">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-ember">
                  Попелястий край · міський вузол
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Вітаємо у VeilFall
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Світ розколотий. Завіса тоншає. Попелястий Прихисток тримає
                  останню дорогу до фронту, ремісничих кварталів і майбутніх
                  кланових володінь. Твій меч. Твій вибір. Твоя спадщина.
                </p>
              </div>
            </section>
            <dl className="mt-3 grid gap-px bg-border/60 sm:grid-cols-4">
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
            <section className="mt-3 border border-border/70 bg-background/45 p-4 sm:p-5">
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
                  icon={Flame}
                  title="Майстерня"
                  description="Кодекс ремесел, паралельні станції та фонове створення матеріалів."
                  action="Відкрити майстерню"
                  onClick={() => setDistrict('CRAFTING')}
                />
                <CityDistrict
                  icon={Swords}
                  title="Воєнна рада"
                  description="Обрати сторону та побачити скриптовий стан фронту свого рівня."
                  action="Відкрити карту фронту"
                  onClick={() => setDistrict('FRONT')}
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
            <section className="mt-3 grid gap-px bg-border/60 md:grid-cols-3">
              <LobbyStatus
                title="Стан війни"
                accent="Відкрити мапу"
                description="Скриптовий фронт змінює контроль щогодини. Ваш рівневий діапазон захищає від сильніших героїв."
                onClick={() => setDistrict('FRONT')}
              />
              <LobbyStatus
                title="Події"
                accent="Міська хроніка"
                description="Кланові лігва та майстерні вже активні. Арена й турніри відкриються у наступних главах."
              />
              <LobbyStatus
                title="Завдання дня"
                accent="Підготовка"
                description="Посильте героя, перевірте ремісничі черги й оберіть сторону перед виходом на фронт."
              />
            </section>
          </>
        ) : district === 'CRAFTING' ? (
          <CraftingWorkshop onBack={() => setDistrict('HUB')} />
        ) : district === 'FRONT' ? (
          <FactionFront onBack={() => setDistrict('HUB')} />
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
                    .filter((resource) => resource.amount > 0)
                    .map(
                      (resource) =>
                        `${resourceName(resource.type)}: ${resource.amount}`,
                    )
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-px bg-border/60 sm:grid-cols-3">
              {talents.talents
                .filter((talent) => !talent.advanced)
                .map((talent) => (
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
            <div className="mt-8 border-l-2 border-ember bg-ember/5 px-4 py-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                Древо Пробудження
              </p>
              <h3 className="mt-2 text-lg font-medium">Сила за межею</h3>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                Відкриваються на 30 рівні та розвиваються лише за Відгомін
                Завіси, здобутий у кланових лігвах. Звичайні очки талантів не
                витрачаються.
              </p>
              <div className="mt-4 grid gap-px bg-border/60 sm:grid-cols-3">
                {talents.talents
                  .filter((talent) => talent.advanced)
                  .map((talent) => (
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
                          !talent.affordable ||
                          talent.rank >= talent.maxRank
                        }
                        onClick={() => onUpgrade(talent.type)}
                        className="mt-4 h-8 w-full rounded-sm"
                      >
                        {talent.unlocked
                          ? talent.rank >= talent.maxRank
                            ? 'Максимум'
                            : `Пробудити · ${talent.costAmount} ${resourceName(talent.costResource)}`
                          : `Відкриється на ${talent.requiredLevel} рівні`}
                      </Button>
                    </div>
                  ))}
              </div>
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
                onUpgradeDevelopment={onUpgradeClanDevelopment}
                boss={clanBoss}
                onSummonBoss={onSummonClanBoss}
                onAttackBoss={onAttackClanBoss}
                onClaimReward={onClaimClanBossReward}
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
    </JourneyShell>
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

function LobbyStatus({
  title,
  accent,
  description,
  onClick,
}: {
  title: string
  accent: string
  description: string
  onClick?: () => void
}) {
  return (
    <article className="bg-background/70 p-4">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
        {title}
      </p>
      <h3 className="mt-2 text-sm font-medium">{accent}</h3>
      <p className="mt-2 min-h-14 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      {onClick ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onClick}
          className="mt-2 h-7 rounded-none px-0 text-xs text-ember"
        >
          Детальніше <ArrowRight aria-hidden="true" />
        </Button>
      ) : null}
    </article>
  )
}

function ClanHall({
  clan,
  personalResources,
  pending,
  onContribute,
  onUpgradeDevelopment,
  boss,
  onSummonBoss,
  onAttackBoss,
  onClaimReward,
}: {
  clan: Clan
  personalResources: Array<{ type: ResourceType; amount: number }>
  pending: boolean
  onContribute: (resourceType: ResourceType, amount: number) => Promise<void>
  onUpgradeDevelopment: (branch: ClanDevelopmentBranch) => Promise<void>
  boss: ClanBoss | null
  onSummonBoss: () => Promise<void>
  onAttackBoss: () => Promise<void>
  onClaimReward: () => Promise<void>
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
                .filter((resource) => resource.amount > 0)
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
      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
              Розвиток клану
            </p>
            <h2 className="mt-2 font-medium">Шляхи спеціалізації</h2>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Рішення приймає голова клану
          </p>
        </div>
        <div className="mt-3 grid gap-px bg-border/60 sm:grid-cols-2">
          {clan.developments.map((development) => {
            const complete = development.rank >= development.maxRank
            const canUpgrade =
              clan.viewerRole === 'LEADER' &&
              development.unlocked &&
              development.affordable &&
              !complete
            return (
              <article
                key={development.branch}
                className="bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{development.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {development.description}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ember">
                    {development.rank}/{development.maxRank}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !canUpgrade}
                  onClick={() => void onUpgradeDevelopment(development.branch)}
                  className="mt-4 h-8 w-full rounded-sm"
                >
                  {complete
                    ? 'Гілку завершено'
                    : !development.unlocked
                      ? `Потрібен рівень клану ${development.requiredClanLevel}`
                      : clan.viewerRole !== 'LEADER'
                        ? 'Рішення голови'
                        : `Розвинути · ${development.costAmount} ${resourceName(development.costResource)}`}
                </Button>
              </article>
            )
          })}
        </div>
      </section>
      <section className="mt-6 border border-border/70 bg-background/45 p-5">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-destructive">
          Кланове лігво
        </p>
        {boss ? (
          <div className="mt-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-medium">
                  {boss.name} · рівень {boss.tier}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Спільний ворог для всього складу клану
                </p>
              </div>
              <span className="font-mono text-sm">
                {boss.currentHealth}/{boss.maxHealth} HP
              </span>
            </div>
            <div className="mt-3 h-2 bg-panel">
              <div
                className="h-full bg-destructive"
                style={{
                  width: `${(boss.currentHealth / boss.maxHealth) * 100}%`,
                }}
              />
            </div>
            <Button
              type="button"
              disabled={
                pending || boss.status !== 'ACTIVE' || !boss.viewerCanAttack
              }
              onClick={() => void onAttackBoss()}
              className="mt-4 h-9 rounded-sm bg-ember text-ink hover:bg-ember-bright"
            >
              {pending
                ? 'Удар готується…'
                : boss.status === 'WON'
                  ? 'Боса переможено'
                  : !boss.viewerCanAttack
                    ? 'Герой вибув із бою'
                    : 'Атакувати боса'}
            </Button>
            {boss.viewerMaxHealth > 0 ? (
              <p
                className={`mt-2 font-mono text-xs ${boss.viewerCanAttack ? 'text-muted-foreground' : 'text-destructive'}`}
              >
                Ваш стан: {boss.viewerCurrentHealth}/{boss.viewerMaxHealth} HP
              </p>
            ) : null}
            {boss.status === 'WON' ? (
              <div className="mt-4 border-l-2 border-moss bg-moss/5 px-4 py-4">
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-moss">
                  Нагорода учасника
                </p>
                <p className="mt-2 text-sm">
                  {boss.rewardAmount} {resourceName(boss.rewardType)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Відгомін Завіси отримують лише герої, які брали участь у
                  переможному бою.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    pending ||
                    !boss.viewerEligibleForReward ||
                    boss.viewerRewardClaimed
                  }
                  onClick={() => void onClaimReward()}
                  className="mt-3 h-8 rounded-sm"
                >
                  {boss.viewerRewardClaimed
                    ? 'Нагороду отримано'
                    : boss.viewerEligibleForReward
                      ? 'Забрати нагороду'
                      : 'Потрібна участь у бою'}
                </Button>
                <div className="mt-4 border-t border-border/70 pt-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
                    Наступний виклик
                  </p>
                  <p className="mt-2 text-sm">
                    Рівень {boss.nextTier} · {boss.nextMaxHealth} HP ·{' '}
                    {boss.rewardAmount * 2} {resourceName(boss.rewardType)}
                  </p>
                  {boss.summonLockedReason ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {boss.summonLockedReason}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={pending || !boss.canSummon}
                    onClick={() => void onSummonBoss()}
                    className="mt-3 h-8 rounded-sm bg-ember text-ink hover:bg-ember-bright"
                  >
                    Викликати сильнішого боса
                  </Button>
                </div>
              </div>
            ) : null}
            {boss.participants.length > 0 ? (
              <div className="mt-4 space-y-2">
                {boss.participants.map((participant) => (
                  <div
                    key={participant.characterId}
                    className="flex justify-between text-xs"
                  >
                    <span>{participant.name}</span>
                    <span
                      className={`font-mono ${participant.defeated ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {participant.damage} шкоди · {participant.actions} дій ·{' '}
                      {participant.defeated
                        ? 'вибув'
                        : `${participant.currentHealth}/${participant.maxHealth} HP`}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              Перший ранг військового шляху відкриває виклик Кістяного велетня.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={
                pending ||
                clan.viewerRole !== 'LEADER' ||
                (clan.developments.find((item) => item.branch === 'MILITARY')
                  ?.rank ?? 0) < 1
              }
              onClick={() => void onSummonBoss()}
              className="h-9 rounded-sm"
            >
              Викликати боса
            </Button>
          </div>
        )}
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
  mode,
  hero,
  inventory,
  talents,
  clan,
  locationName,
  pending,
  error,
  onBack,
  onEquip,
}: {
  mode: 'PROFILE' | 'INVENTORY'
  hero: Hero
  inventory: Inventory
  talents: TalentTree | null
  clan: Clan | null
  locationName: string
  pending: boolean
  error: string | null
  onBack: () => void
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
}) {
  const weapon = inventory.equipped.find(
    (entry) => entry.slot === 'MAIN_HAND',
  )?.item
  const equippedBySlot = new Map(
    inventory.equipped.map((entry) => [entry.slot, entry.item]),
  )

  if (mode === 'INVENTORY')
    return (
      <InventoryVault
        hero={hero}
        inventory={inventory}
        locationName={locationName}
        pending={pending}
        error={error}
        onBack={onBack}
        onEquip={onEquip}
      />
    )

  return (
    <section className="mx-auto w-full max-w-6xl border border-border/70 bg-panel/60">
      <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ember">
            {locationName} · персонаж
          </p>
          <h1 className="mt-1 text-xl font-semibold">Профіль {hero.name}</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-9 rounded-sm"
        >
          <ArrowLeft aria-hidden="true" /> Повернутися
        </Button>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative min-h-[34rem] overflow-hidden border-b border-border/70 p-5 sm:p-6 lg:border-r lg:border-b-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,oklch(0.52_0.1_55/20%),transparent_40%)]" />
          <p className="text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-moss">
            {archetypeName(hero.archetype)} · рівень {hero.level}
          </p>
          <h2 className="relative mt-2 text-center font-serif text-2xl text-ember">
            {weapon?.setName ?? 'Мандрівник Попелястого краю'}
          </h2>
          <div className="relative mx-auto mt-7 grid max-w-xl grid-cols-[7rem_1fr_7rem] gap-3">
            <div className="space-y-3">
              <EquipmentSlot label="Шолом" item={equippedBySlot.get('HEAD')} />
              <EquipmentSlot
                label="Наплечники"
                item={equippedBySlot.get('SHOULDERS')}
              />
              <EquipmentSlot
                label="Нагрудник"
                item={equippedBySlot.get('CHEST')}
              />
              <EquipmentSlot
                label="Наручі"
                item={equippedBySlot.get('BRACERS')}
              />
              <EquipmentSlot
                label="Рукавиці"
                item={equippedBySlot.get('HANDS')}
              />
              <EquipmentSlot label="Штани" item={equippedBySlot.get('LEGS')} />
              <EquipmentSlot
                label="Черевики"
                item={equippedBySlot.get('FEET')}
              />
            </div>
            <div className="flex min-h-80 flex-col items-center justify-center border-x border-ember/20 bg-background/25 px-3">
              <div className="grid size-20 place-items-center rounded-full border border-ember/60 bg-ember/10 shadow-[0_0_3rem_oklch(0.55_0.12_55/20%)]">
                <Shield className="size-10 text-ember" aria-hidden="true" />
              </div>
              <div className="mt-5 h-36 w-24 border border-border/80 bg-panel/80 [clip-path:polygon(15%_0,85%_0,100%_100%,0_100%)]" />
              <div className="mt-3 w-full">
                <EquipmentSlot label="Основна рука" item={weapon} />
                <p className="mt-2 text-center font-mono text-[0.58rem] uppercase tracking-wider text-ember">
                  {weapon ? `+${weapon.damage} DMG` : 'Без зброї'}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <EquipmentSlot
                label="Амулет"
                item={equippedBySlot.get('AMULET')}
              />
              <EquipmentSlot
                label="Браслет"
                item={equippedBySlot.get('BRACELET')}
              />
              <EquipmentSlot
                label="Каблучка I"
                item={equippedBySlot.get('RING_LEFT')}
              />
              <EquipmentSlot
                label="Каблучка II"
                item={equippedBySlot.get('RING_RIGHT')}
              />
              <EquipmentSlot label="Пояс" item={equippedBySlot.get('WAIST')} />
              <EquipmentSlot
                label="Друга рука"
                item={equippedBySlot.get('OFF_HAND')}
              />
            </div>
          </div>
          <p className="relative mt-5 text-center text-xs text-muted-foreground">
            {inventory.mainHandVisualAssetId ?? 'Базовий вигляд без зброї'}
          </p>
        </section>
        <aside className="p-5">
          <ProfileSummary
            hero={hero}
            inventory={inventory}
            talents={talents}
            clan={clan}
            weapon={weapon}
          />
        </aside>
      </div>
    </section>
  )
}

function EquipmentSlot({
  label,
  item,
}: {
  label: string
  item?: InventoryItem
}) {
  return (
    <div className="grid min-h-12 place-items-center border border-border/70 bg-background/55 px-2 text-center">
      <div>
        <Package
          className={`mx-auto size-4 ${item ? 'text-ember' : 'text-muted-foreground/60'}`}
          aria-hidden="true"
        />
        <p className="mt-1 font-mono text-[0.52rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {item ? (
          <p className="mt-1 truncate text-[0.58rem] text-foreground">
            {item.name}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function InventoryVault({
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
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
}) {
  const equippedBySlot = new Map(
    inventory.equipped.map((entry) => [entry.slot, entry.item]),
  )

  return (
    <section className="mx-auto w-full max-w-6xl border border-border/70 bg-panel/60">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ember">
            {locationName} · інвентар
          </p>
          <h1 className="mt-1 text-xl font-semibold">Сховище героя</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-9 rounded-sm"
        >
          <ArrowLeft aria-hidden="true" /> Повернутися
        </Button>
      </header>

      <div className="border-b border-border/70 bg-background/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-moss">
              Сундук
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Постійне безпечне сховище предметів героя.
            </p>
          </div>
          <dl className="flex gap-px bg-border/70 text-center">
            <InventoryCount label="У сундуку" value={inventory.chest.length} />
            <InventoryCount
              label="У рюкзаку"
              value={inventory.backpack.length}
            />
            <InventoryCount
              label="Екіпіровано"
              value={inventory.equipped.length}
            />
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {['Усі предмети', 'Зброя', 'Броня', 'Аксесуари', 'Матеріали'].map(
            (label, index) => (
              <Button
                key={label}
                type="button"
                variant={index === 0 ? 'secondary' : 'outline'}
                disabled={index !== 0}
                className="h-8 rounded-none px-3 text-xs"
              >
                {label}
              </Button>
            ),
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {inventory.chest.length === 0 ? (
          <div className="grid min-h-72 place-items-center border border-dashed border-border/70 bg-background/25 p-8 text-center">
            <div>
              <Package
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 font-medium">Сундук порожній</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Перенесіть сюди здобич після повернення з походу.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inventory.chest.map((item) => (
              <InventoryItemCard
                key={item.id}
                hero={hero}
                item={item}
                equippedBySlot={equippedBySlot}
                pending={pending}
                onEquip={onEquip}
              />
            ))}
          </div>
        )}
        {error ? (
          <p
            role="alert"
            className="mt-4 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function InventoryItemCard({
  hero,
  item,
  equippedBySlot,
  pending,
  onEquip,
}: {
  hero: Hero
  item: InventoryItem
  equippedBySlot: ReadonlyMap<EquipmentSlotKey, InventoryItem>
  pending: boolean
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
}) {
  const targetSlot =
    item.compatibleSlots.find((slot) => !equippedBySlot.has(slot)) ??
    item.compatibleSlots[0]
  const current = targetSlot ? equippedBySlot.get(targetSlot) : undefined
  const statDeltas = [
    ['DMG', item.damage - (current?.damage ?? 0)],
    ['ARM', item.armor - (current?.armor ?? 0)],
    ['HP', item.health - (current?.health ?? 0)],
  ] as const

  return (
    <article className="flex min-h-56 flex-col border border-border/70 bg-background/45 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center border border-ember/45 bg-ember/5">
          {item.armor > item.damage ? (
            <Shield className="size-5 text-ember" aria-hidden="true" />
          ) : (
            <Sword className="size-5 text-ember" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-medium leading-5">{item.name}</h2>
          <p className="mt-1 font-mono text-[0.58rem] uppercase tracking-wider text-ember">
            {itemRarityName(item.rarity)} · {item.itemLevel} рівень
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {item.setName}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-px bg-border/60 text-xs">
        {[
          ['DMG', item.damage],
          ['ARM', item.armor],
          ['HP', item.health],
        ].map(([label, value]) => (
          <div key={label} className="bg-panel/80 p-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-mono">+{value}</dd>
          </div>
        ))}
        <div className="bg-panel/80 p-2">
          <dt className="text-muted-foreground">Якість</dt>
          <dd className="mt-1 font-mono">
            {Math.round((item.rollQuality / 9_999) * 100)}%
          </dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {statDeltas.map(([label, delta]) => (
          <div key={label} className="flex justify-between gap-1">
            <span className="text-muted-foreground">{label}</span>
            <span className={`font-mono ${deltaColor(delta)}`}>
              {formatDelta(delta)}
            </span>
          </div>
        ))}
      </div>
      <Button
        type="button"
        disabled={
          pending ||
          item.itemLevel > hero.level ||
          item.compatibleSlots.length === 0
        }
        onClick={() => {
          if (targetSlot) onEquip(item.id, targetSlot)
        }}
        className="mt-auto h-9 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
      >
        {pending
          ? 'Екіпіруємо…'
          : targetSlot
            ? `Екіпірувати: ${EQUIPMENT_SLOT_NAMES[targetSlot]}`
            : 'Несумісний предмет'}
      </Button>
    </article>
  )
}

function ProfileSummary({
  hero,
  inventory,
  talents,
  clan,
  weapon,
}: {
  hero: Hero
  inventory: Inventory
  talents: TalentTree | null
  clan: Clan | null
  weapon: InventoryItem | undefined
}) {
  return (
    <>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ember">
        Статистика героя
      </p>
      <dl className="mt-4 divide-y divide-border/60 border-y border-border/70 bg-background/35 px-3">
        <ProfileStat label="Здоров’я" value={inventory.totalHealth} />
        <ProfileStat label="Захист" value={inventory.totalArmor} />
        <ProfileStat label="Базова атака" value={inventory.baseDamage} />
        <ProfileStat
          label="Бонус екіпіровки"
          value={`+${inventory.totalDamage - inventory.baseDamage} DMG`}
          accent
        />
        <ProfileStat
          label="Загальний DMG"
          value={inventory.totalDamage}
          accent
        />
        <ProfileStat label="Рівень" value={hero.level} />
        <ProfileStat
          label="Досвід"
          value={`${hero.experienceIntoLevel}/${hero.experienceForNextLevel}`}
        />
        <ProfileStat
          label="Очки талантів"
          value={talents?.availablePoints ?? 0}
        />
        <ProfileStat
          label="Основна рука"
          value={weapon?.name ?? 'Слот порожній'}
        />
        <ProfileStat label="Екіпіровано" value={inventory.equipped.length} />
        <ProfileStat label="Клан" value={clan?.name ?? '—'} />
      </dl>

      <div className="mt-6 border-t border-border/70 pt-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
          Нагороди й відзнаки
        </p>
        <div className="mt-3 space-y-2">
          <AwardBadge
            title="Вартовий застави"
            description="Шлях героя розпочато у Попелястому краї."
            earned
          />
          <AwardBadge
            title="Перше озброєння"
            description={
              weapon ? weapon.name : 'Екіпіруйте першу постійну зброю.'
            }
            earned={Boolean(weapon)}
          />
          <AwardBadge
            title="Кланове братство"
            description={
              clan
                ? `Здобуто разом із кланом ${clan.name}.`
                : 'Приєднайтеся до клану.'
            }
            earned={Boolean(clan)}
          />
        </div>
      </div>
    </>
  )
}

function ProfileStat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`max-w-[60%] truncate text-right font-mono text-sm ${accent ? 'text-ember' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}

function AwardBadge({
  title,
  description,
  earned,
}: {
  title: string
  description: string
  earned: boolean
}) {
  return (
    <div
      className={`border p-3 ${earned ? 'border-ember/50 bg-ember/5' : 'border-border/70 bg-background/35 opacity-60'}`}
    >
      <div className="flex items-center gap-2">
        <Shield
          className={`size-4 ${earned ? 'text-ember' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function InventoryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/60 px-2 py-3">
      <dt className="font-mono text-[0.52rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}

async function executeInventoryMutation(
  itemId: string,
  slot: EquipmentSlotKey,
  expectedCharacterVersion: number,
): Promise<Inventory> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Equip($input: EquipItemInput!) { equipItem(input: $input) { characterVersion baseDamage totalDamage baseArmor totalArmor baseHealth totalHealth mainHandVisualAssetId chest { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } backpack { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } equipped { slot item { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } } } }',
      variables: {
        input: {
          itemId,
          slot,
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
  clanBoss: ClanBoss | null
  redirect: string | null
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ viewer { id } myCharacter { name archetype level experience experienceIntoLevel experienceForNextLevel gold baseStats { health damage armor } } currentLocation { currentLocation preparationChoice version routes { destination locked lockReason } } myInventory { characterVersion baseDamage totalDamage baseArmor totalArmor baseHealth totalHealth mainHandVisualAssetId chest { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } backpack { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } equipped { slot item { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setName visualAssetId } } } myTalents { characterVersion availablePoints resources { type amount } talents { type name description rank maxRank requiredLevel effectPerRank advanced unlocked costResource costAmount affordable } } myClan { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } currentClanBoss { id name tier status maxHealth currentHealth version canSummon nextTier nextMaxHealth summonLockedReason viewerEligibleForReward viewerRewardClaimed viewerCanAttack viewerCurrentHealth viewerMaxHealth rewardType rewardAmount participants { characterId name damage actions maxHealth currentHealth defeated } } }',
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
        currentClanBoss?: ClanBoss | null
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
        clanBoss: null,
        redirect: '/auth',
      }
    if (!payload.data.myCharacter)
      return {
        hero: null,
        world: null,
        inventory: null,
        talents: null,
        clan: null,
        clanBoss: null,
        redirect: '/character/create',
      }
    return {
      hero: payload.data.myCharacter,
      world: payload.data.currentLocation ?? null,
      inventory: payload.data.myInventory ?? null,
      talents: payload.data.myTalents ?? null,
      clan: payload.data.myClan ?? null,
      clanBoss: payload.data.currentClanBoss ?? null,
      redirect: null,
    }
  } catch {
    return {
      hero: null,
      world: null,
      inventory: null,
      talents: null,
      clan: null,
      clanBoss: null,
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
        ? 'mutation CreateClan($input: CreateClanInput!) { createClan(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } }'
        : 'mutation JoinClan($input: JoinClanInput!) { joinClan(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } }',
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
        'mutation Contribute($input: ContributeClanResourceInput!) { contributeClanResource(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } }',
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

async function executeClanDevelopment(
  branch: ClanDevelopmentBranch,
  expectedClanVersion: number,
): Promise<Clan> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Develop($input: UpgradeClanDevelopmentInput!) { upgradeClanDevelopment(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } }',
      variables: {
        input: {
          branch,
          expectedClanVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { upgradeClanDevelopment: Clan }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('CLAN_DEVELOPMENT_FAILED')
  return payload.data.upgradeClanDevelopment
}

async function executeClanBossMutation(
  action: 'SUMMON' | 'ATTACK',
  input: Record<string, unknown>,
): Promise<ClanBoss> {
  const summoning = action === 'SUMMON'
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: summoning
        ? 'mutation Summon($input: SummonClanBossInput!) { summonClanBoss(input: $input) { id name tier status maxHealth currentHealth version canSummon nextTier nextMaxHealth summonLockedReason viewerEligibleForReward viewerRewardClaimed viewerCanAttack viewerCurrentHealth viewerMaxHealth rewardType rewardAmount participants { characterId name damage actions maxHealth currentHealth defeated } } }'
        : 'mutation Attack($input: AttackClanBossInput!) { attackClanBoss(input: $input) { id name tier status maxHealth currentHealth version canSummon nextTier nextMaxHealth summonLockedReason viewerEligibleForReward viewerRewardClaimed viewerCanAttack viewerCurrentHealth viewerMaxHealth rewardType rewardAmount participants { characterId name damage actions maxHealth currentHealth defeated } } }',
      variables: { input },
    }),
  })
  const payload = (await response.json()) as {
    data?: { summonClanBoss?: ClanBoss; attackClanBoss?: ClanBoss }
    errors?: unknown
  }
  const result = summoning
    ? payload.data?.summonClanBoss
    : payload.data?.attackClanBoss
  if (!response.ok || payload.errors || !result)
    throw new Error('CLAN_BOSS_COMMAND_FAILED')
  return result
}

async function executeClanBossRewardMutation(
  encounterId: string,
): Promise<ClanBoss> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation Claim($input: ClaimClanBossRewardInput!) { claimClanBossReward(input: $input) { id name tier status maxHealth currentHealth version canSummon nextTier nextMaxHealth summonLockedReason viewerEligibleForReward viewerRewardClaimed viewerCanAttack viewerCurrentHealth viewerMaxHealth rewardType rewardAmount participants { characterId name damage actions maxHealth currentHealth defeated } } }',
      variables: {
        input: { encounterId, idempotencyKey: crypto.randomUUID() },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { claimClanBossReward: ClanBoss }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('CLAN_BOSS_REWARD_FAILED')
  return payload.data.claimClanBossReward
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
        'mutation Upgrade($input: UpgradeTalentInput!) { upgradeTalent(input: $input) { characterVersion availablePoints resources { type amount } talents { type name description rank maxRank requiredLevel effectPerRank advanced unlocked costResource costAmount affordable } } }',
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
  return {
    IRON: 'залізо',
    COPPER: 'мідь',
    BRONZE: 'бронза',
    COAL: 'вугілля',
    TIMBER: 'деревина',
    LEATHER: 'шкіра',
    HERBS: 'лікувальні трави',
    OBSIDIAN_SHARD: 'уламок обсидіану',
    VEIL_STEEL: 'сталь Завіси',
    STABILIZED_CATALYST: 'стабілізований каталізатор',
    VEIL_ECHO: 'відгомін Завіси',
    CURSED_HEART: 'серце Проклятого лицаря',
    FALLEN_ELF_EYE: 'око Павшого ельфа',
    DARK_PRIEST_ASH: 'попіл Темного жерця',
  }[value]
}

function itemRarityName(value: string): string {
  return (
    {
      COMMON: 'Звичайний',
      UNCOMMON: 'Незвичайний',
      RARE: 'Рідкісний',
      EPIC: 'Епічний',
      LEGENDARY: 'Легендарний',
      MYTHIC: 'Міфічний',
      DIVINE: 'Божественний',
    }[value] ?? value
  )
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

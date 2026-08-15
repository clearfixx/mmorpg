'use client'

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Castle,
  Compass,
  Eye,
  Flame,
  Hammer,
  Package,
  Search,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Sword,
  Swords,
  Target,
  Trophy,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CraftingWorkshop } from '@/components/crafting/crafting-workshop'
import { FactionFront } from '@/components/factions/faction-front'
import {
  GameHeroBanner,
  GameMetric,
  GamePanel,
  GamePosterGrid,
  GameServiceCard,
  gameUi,
} from '@/components/game-ui/game-dashboard'
import { GameShell, type GameSection } from '@/components/layout/game-shell'
import { Marketplace } from '@/components/market/marketplace'
import { TemperingForge } from '@/components/tempering/tempering-forge'
import { BattleEncounter } from '@/components/world/battle-encounter'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const worldStateFields =
  'currentLocation preparationChoice version highestClearedTier dryadHighestClearedTier cinderhavenUnlockTier cinderhavenUnlocked watchpostVoices { id name role line } routes { destination locked lockReason }'
const inventoryFields =
  'characterVersion baseDamage totalDamage baseArmor totalArmor baseHealth totalHealth mainHandVisualAssetId activeSetBonuses { setId setName equippedPieces requiredPieces name damage armor health } setBonusProgress { setId setName equippedPieces requiredPieces name damage armor health active } chest { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setId setName visualAssetId temperingStage temperingProgress temperingVersion } backpack { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setId setName visualAssetId temperingStage temperingProgress temperingVersion } equipped { slot item { id name itemLevel rarity rollQuality damage armor health damageMin damageMax compatibleSlots binding setId setName visualAssetId temperingStage temperingProgress temperingVersion } }'

type Preparation = 'SEARCH_ARMORY' | 'INSPECT_TRACKS' | 'REST_BRAZIER'
type Location =
  'BROKEN_WATCHPOST' | 'HOLLOW_ROAD' | 'CINDERHAVEN_GATE' | 'DRYAD_FOREST'

interface WorldState {
  currentLocation: Location
  preparationChoice: Preparation | null
  version: number
  highestClearedTier: number
  dryadHighestClearedTier: number
  cinderhavenUnlockTier: number
  cinderhavenUnlocked: boolean
  watchpostVoices: Array<{
    id: string
    name: string
    role: string
    line: string
  }>
  routes: Array<{
    destination: Location
    locked: boolean
    lockReason: string | null
  }>
}

interface WorldMap {
  nodes: Array<{
    id: string
    name: string
    kind: string
    status: 'CURRENT' | 'AVAILABLE' | 'LOCKED' | 'FUTURE'
    stages: number | null
    note: string | null
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
  setId: string
  setName: string
  visualAssetId: string
  temperingStage: number
  temperingProgress: number
  temperingVersion: number
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

type InventoryCategory = 'ALL' | 'WEAPON' | 'ARMOR' | 'ACCESSORY'
type InventorySort = 'POWER' | 'LEVEL' | 'RARITY' | 'NAME'
type InventoryScope = 'ALL' | 'CHEST' | 'BACKPACK'
type InventoryUsability = 'ALL' | 'USABLE' | 'LOCKED'
type InventoryDirection = 'DESC' | 'ASC'
type InventoryDensity = 'COMFORTABLE' | 'COMPACT'

const inventoryViewKey = 'veilfall.inventory-view'
const favoriteItemsKey = 'veilfall.favorite-items'
const inventoryItemsPerPage = 20
const inventoryPageSizes = [12, 20, 40] as const

const INVENTORY_RARITY_ORDER: Record<string, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
  DIVINE: 6,
}

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
  activeSetBonuses: Array<{
    setId: string
    setName: string
    equippedPieces: number
    requiredPieces: number
    name: string
    damage: number
    armor: number
    health: number
  }>
  setBonusProgress: Array<{
    setId: string
    setName: string
    equippedPieces: number
    requiredPieces: number
    name: string
    damage: number
    armor: number
    health: number
    active: boolean
  }>
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
  | 'WEAPON_FRAGMENT'
  | 'HEALTH_POTION'
  | 'MANA_POTION'
  | 'HERBS'
  | 'OBSIDIAN_SHARD'
  | 'VEIL_STEEL'
  | 'STABILIZED_CATALYST'
  | 'VEIL_ECHO'
  | 'CURSED_HEART'
  | 'FALLEN_ELF_EYE'
  | 'DARK_PRIEST_ASH'
  | 'BOSS_INVOCATION_SEAL'
  | 'DARK_PRIEST_INVOCATION_SEAL'
  | 'DRYAD_HEARTWOOD'

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
  | 'LOBBY'
  | 'WATCHPOST'
  | 'PROFILE'
  | 'INVENTORY'
  | 'CRAFTING'
  | 'CLAN'
  | 'FRONT'

type CityDistrictKey =
  'HUB' | 'TRAINING' | 'CRAFTING' | 'TEMPERING' | 'FRONT' | 'CLAN' | 'MARKET'

function cityDistrictName(district: CityDistrictKey) {
  return {
    HUB: 'Попелястий Прихисток',
    TRAINING: 'Зала гарту',
    CRAFTING: 'Майстерня',
    TEMPERING: 'Висока кузня',
    FRONT: 'Воєнна рада',
    CLAN: 'Клановий двір',
    MARKET: 'Торгові ряди',
  }[district]
}

function locationName(location: Location) {
  if (location === 'DRYAD_FOREST') return 'Ліс дріад'
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
  pageTitle,
  pageSubtitle,
  hideWorldSidebar,
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
  pageTitle?: string
  pageSubtitle?: string
  hideWorldSidebar?: boolean
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
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      hideWorldSidebar={hideWorldSidebar}
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
  const [worldMap, setWorldMap] = useState<WorldMap | null>(null)
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
        setWorldMap(result.worldMap)
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
        `mutation Prepare($input: PrepareLocationInput!) { performLocationAction(input: $input) { ${worldStateFields} } }`,
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

  async function refreshJourney() {
    const refreshed = await loadJourney()
    if (refreshed.redirect) return window.location.replace(refreshed.redirect)
    setHero(refreshed.hero)
    setWorld(refreshed.world)
    setWorldMap(refreshed.worldMap)
    setInventory(refreshed.inventory)
    setTalents(refreshed.talents)
    setClan(refreshed.clan)
    setClanBoss(refreshed.clanBoss)
  }

  async function travel(destination: Location) {
    if (!world || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await executeWorldMutation(
        `mutation Travel($input: TravelInput!) { travel(input: $input) { ${worldStateFields} } }`,
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
          onOpenInventory={() => setView('INVENTORY')}
          onUnequip={async (slot) => {
            if (pending) return
            setPending(true)
            setError(null)
            try {
              const next = await executeUnequipMutation(
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
              setError('Не вдалося зняти предмет. Стан героя вже оновлено.')
            } finally {
              setPending(false)
            }
          }}
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

  if (world.currentLocation === 'DRYAD_FOREST' && view === 'LOBBY')
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
        <HollowRoad
          hero={hero}
          preparation="REST_BRAZIER"
          region="DRYAD_FOREST"
        />
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
        onReturn={async () => {
          await travel('BROKEN_WATCHPOST')
          setView('LOBBY')
        }}
        onEnterDryadForest={async () => {
          await travel('DRYAD_FOREST')
          setView('LOBBY')
        }}
        onOpenProfile={() => setView('PROFILE')}
        onOpenEquipment={() => setView('INVENTORY')}
        onRefresh={refreshJourney}
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
        onInvokeCursedKnight={async () => {
          if (pending) return
          setPending(true)
          setError(null)
          try {
            await executeBossInvocation('CURSED_KNIGHT')
            window.location.reload()
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) setTalents(refreshed.talents)
            setError(
              'Ритуал не розпочався. Потрібні 30 рівень, печатка виклику та вільне поле бою.',
            )
            setPending(false)
          }
        }}
        onInvokeFallenElf={async () => {
          if (pending) return
          setPending(true)
          setError(null)
          try {
            await executeBossInvocation('FALLEN_ELF')
            window.location.reload()
          } catch {
            const refreshed = await loadJourney()
            if (!refreshed.redirect) setTalents(refreshed.talents)
            setError(
              'Виклик не відбувся. Для ритуалу Павшого ельфа потрібні три Серця Проклятого лицаря.',
            )
            setPending(false)
          }
        }}
        onInvokeDarkPriest={() =>
          invokeBoss(setPending, setError, 'DARK_PRIEST')
        }
        onInvokeVeilWardenFromEyes={() =>
          invokeBoss(setPending, setError, 'VEIL_WARDEN_EYES')
        }
        onInvokeVeilWardenFromAsh={() =>
          invokeBoss(setPending, setError, 'VEIL_WARDEN_ASH')
        }
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

  if (view === 'LOBBY')
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
        <LobbyDashboard
          hero={hero}
          inventory={inventory}
          clan={clan}
          world={world}
          worldMap={worldMap}
          cinderhaven={cinderhaven}
          pending={pending}
          onOpenWatchpost={() => setView('WATCHPOST')}
          onEnterCinderhaven={() => travel('CINDERHAVEN_GATE')}
          onOpenInventory={() => setView('INVENTORY')}
          onOpenCrafting={() => setView('CRAFTING')}
          onOpenClan={() => setView('CLAN')}
          onOpenFront={() => setView('FRONT')}
        />
      </JourneyShell>
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

            <div className="mt-7 grid gap-px bg-border/60 sm:grid-cols-3">
              {world.watchpostVoices.map((voice) => (
                <article key={voice.id} className="bg-panel/85 p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-wider text-moss">
                    {voice.role}
                  </p>
                  <h3 className="mt-2 text-sm font-medium">{voice.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    «{voice.line}»
                  </p>
                </article>
              ))}
            </div>

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
          </div>
        </section>
      </div>
    </JourneyShell>
  )
}

function LobbyDashboard({
  hero,
  inventory,
  clan,
  world,
  worldMap,
  cinderhaven,
  pending,
  onOpenWatchpost,
  onEnterCinderhaven,
  onOpenInventory,
  onOpenCrafting,
  onOpenClan,
  onOpenFront,
}: {
  hero: Hero
  inventory: Inventory | null
  clan: Clan | null
  world: WorldState
  worldMap: WorldMap | null
  cinderhaven:
    | { destination: Location; locked: boolean; lockReason: string | null }
    | undefined
  pending: boolean
  onOpenWatchpost: () => void
  onEnterCinderhaven: () => void
  onOpenInventory: () => void
  onOpenCrafting: () => void
  onOpenClan: () => void
  onOpenFront: () => void
}) {
  const damage = inventory?.totalDamage ?? hero.baseStats.damage

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3">
      <section className="relative min-h-72 overflow-hidden border border-border/70 bg-[linear-gradient(105deg,rgba(12,10,8,0.98)_5%,rgba(19,15,11,0.86)_52%,rgba(55,30,20,0.42)),radial-gradient(circle_at_78%_45%,rgba(191,82,40,0.26),transparent_34%)] px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(205,112,55,0.13),transparent_66%)]" />
        <div className="relative max-w-2xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-ember">
            Попелястий край · серверний світ
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
            Вітаємо у VeilFall
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Світ розколотий, а Завіса тоншає. Оберіть наступний шлях, стежте за
            війною фракцій і повертайтеся до тих рубежів, які ще пам’ятають ваше
            ім’я.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="border border-ember/40 bg-background/55 px-3 py-2 text-ember">
              Рівень {hero.level}
            </span>
            <span className="border border-border/70 bg-background/55 px-3 py-2">
              Сила {damage}
            </span>
            <span className="border border-border/70 bg-background/55 px-3 py-2">
              {clan?.name ?? 'Без клану'}
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Швидкі активності"
        className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-6"
      >
        <LobbyActivity
          icon={Swords}
          title="Зламана застава"
          subtitle="Підготовка · PvE-похід"
          onClick={onOpenWatchpost}
        />
        <LobbyActivity
          icon={Castle}
          title="Попелястий Прихисток"
          subtitle={
            cinderhaven?.locked
              ? (cinderhaven.lockReason ?? 'Шлях зачинено')
              : 'Місто · розвиток героя'
          }
          disabled={pending || cinderhaven?.locked !== false}
          onClick={onEnterCinderhaven}
        />
        <LobbyActivity
          icon={Package}
          title="Інвентар"
          subtitle={`${inventory?.chest.length ?? 0} предметів у сундуку`}
          onClick={onOpenInventory}
        />
        <LobbyActivity
          icon={Flame}
          title="Майстерня"
          subtitle="Крафт і черги створення"
          onClick={onOpenCrafting}
        />
        <LobbyActivity
          icon={Trophy}
          title="Клан"
          subtitle={clan?.name ?? 'Знайти союзників'}
          onClick={onOpenClan}
        />
        <LobbyActivity
          icon={Compass}
          title="Карта війни"
          subtitle="Фракції та території"
          onClick={onOpenFront}
        />
      </section>

      <section className="border border-border/70 bg-background/75 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ember">
              Наскрізний шлях світу
            </p>
            <h2 className="mt-1 font-serif text-xl">
              Від Світанку до Присмерку
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Порожня дорога:{' '}
            {Math.min(world.highestClearedTier, world.cinderhavenUnlockTier)}/
            {world.cinderhavenUnlockTier}
          </p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {worldMap?.nodes.map((node) => (
            <article
              key={node.id}
              className={`min-w-44 border p-3 ${node.status === 'AVAILABLE' || node.status === 'CURRENT' ? 'border-ember/60 bg-ember/5' : 'border-border/70 bg-panel/55 opacity-70'}`}
            >
              <p className="font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">
                {node.kind}
              </p>
              <h3 className="mt-2 text-sm font-medium">{node.name}</h3>
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                {node.note ??
                  (node.status === 'FUTURE'
                    ? 'Майбутній регіон'
                    : node.stages
                      ? `${node.stages} етапів`
                      : 'Доступно')}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.05fr_1fr_1fr]">
        <LobbyPanel
          icon={Swords}
          title="Стан війни"
          action="Оновлення через 12:34"
        >
          <div className="space-y-4">
            <FactionInfluence
              name="Вартові Завіси"
              value={64}
              color="bg-destructive"
            />
            <FactionInfluence
              name="Тіньовий Ковен"
              value={36}
              color="bg-sky-700"
            />
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Контроль над землями: 19 із 28 територій.
            </p>
          </div>
        </LobbyPanel>
        <LobbyPanel
          icon={CalendarDays}
          title="Найближчі події"
          action="Сьогодні"
        >
          <LobbyLine
            title="Битва за Північну заставу"
            meta="через 28 хв"
            accent
          />
          <LobbyLine title="Вітри Завіси" meta="через 1 год 45 хв" />
          <LobbyLine title="Турнір кланів" meta="через 6 год" />
        </LobbyPanel>
        <LobbyPanel
          icon={Target}
          title="Завдання дня"
          action="Оновлення опівночі"
        >
          <DailyTask title="Здобути 10 перемог" progress="6/10" percent={60} />
          <DailyTask
            title="Зібрати 25 ресурсів"
            progress="10/25"
            percent={40}
          />
          <DailyTask title="Завершити 3 ремесла" progress="1/3" percent={33} />
        </LobbyPanel>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <LobbyPanel
          icon={Castle}
          title="Контроль територій"
          action="Попелястий край"
        >
          <div className="grid gap-px bg-border/60 sm:grid-cols-2">
            <Territory name="Північна застава" status="Наш контроль" />
            <Territory name="Західна застава" status="Наш контроль" />
            <Territory name="Східна застава" status="Оспорюється" contested />
            <Territory
              name="Південна застава"
              status="Під контролем ворога"
              enemy
            />
          </div>
        </LobbyPanel>
        <LobbyPanel
          icon={ScrollText}
          title="Хроніка світу"
          action="Останні події"
        >
          <LobbyLine
            title="Фронт Завіси змістився на схід"
            meta="12 хв тому"
            accent
          />
          <LobbyLine
            title="Майстерні Прихистку відновили роботу"
            meta="24 хв тому"
          />
          <LobbyLine
            title={
              clan
                ? `Клан ${clan.name} тримає раду`
                : 'Новий клан вступив у світ'
            }
            meta="1 год тому"
          />
        </LobbyPanel>
      </section>
    </main>
  )
}

function LobbyActivity({
  icon: Icon,
  title,
  subtitle,
  disabled = false,
  onClick,
}: {
  icon: typeof Swords
  title: string
  subtitle: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group min-h-32 bg-panel/85 p-4 text-left transition hover:bg-ember/8 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon
        className="size-5 text-ember transition group-hover:text-ember-bright"
        aria-hidden="true"
      />
      <span className="mt-5 block font-medium">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {subtitle}
      </span>
    </button>
  )
}

function LobbyPanel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Swords
  title: string
  action: string
  children: ReactNode
}) {
  return (
    <section className="border border-border/70 bg-panel/70">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 font-medium">
          <Icon className="size-4 text-ember" aria-hidden="true" />
          {title}
        </h2>
        <span className="font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">
          {action}
        </span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function FactionInfluence({
  name,
  value,
  color,
}: {
  name: string
  value: number
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-background">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function LobbyLine({
  title,
  meta,
  accent = false,
}: {
  title: string
  meta: string
  accent?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <p className={`text-sm ${accent ? 'text-ember' : ''}`}>{title}</p>
      <span className="shrink-0 font-mono text-[0.6rem] text-muted-foreground">
        {meta}
      </span>
    </div>
  )
}

function DailyTask({
  title,
  progress,
  percent,
}: {
  title: string
  progress: string
  percent: number
}) {
  return (
    <div className="border-b border-border/50 py-2.5 last:border-0">
      <div className="flex justify-between gap-4 text-sm">
        <span>{title}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {progress}
        </span>
      </div>
      <div className="mt-2 h-1 bg-background">
        <div className="h-full bg-moss" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Territory({
  name,
  status,
  contested = false,
  enemy = false,
}: {
  name: string
  status: string
  contested?: boolean
  enemy?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-background/50 px-3 py-3 text-sm">
      <span>{name}</span>
      <span
        className={`text-xs ${enemy ? 'text-sky-400' : contested ? 'text-ember' : 'text-moss'}`}
      >
        {status}
      </span>
    </div>
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
  onEnterDryadForest,
  onOpenProfile,
  onOpenEquipment,
  onRefresh,
  onCreateClan,
  onJoinClan,
  onContributeClan,
  onUpgradeClanDevelopment,
  onSummonClanBoss,
  onAttackClanBoss,
  onClaimClanBossReward,
  onInvokeCursedKnight,
  onInvokeFallenElf,
  onInvokeDarkPriest,
  onInvokeVeilWardenFromEyes,
  onInvokeVeilWardenFromAsh,
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
  onEnterDryadForest: () => void
  onOpenProfile: () => void
  onOpenEquipment: () => void
  onRefresh: () => Promise<void>
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
  onInvokeCursedKnight: () => Promise<void>
  onInvokeFallenElf: () => Promise<void>
  onInvokeDarkPriest: () => Promise<void>
  onInvokeVeilWardenFromEyes: () => Promise<void>
  onInvokeVeilWardenFromAsh: () => Promise<void>
  onUpgrade: (type: TalentType) => void
}) {
  const [district, setDistrict] = useState<CityDistrictKey>(initialDistrict)
  const [clanName, setClanName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const invocationSeals =
    talents?.resources.find(
      (resource) => resource.type === 'BOSS_INVOCATION_SEAL',
    )?.amount ?? 0
  const cursedHearts =
    talents?.resources.find((resource) => resource.type === 'CURSED_HEART')
      ?.amount ?? 0
  const darkPriestSeals =
    talents?.resources.find(
      (resource) => resource.type === 'DARK_PRIEST_INVOCATION_SEAL',
    )?.amount ?? 0
  const fallenElfEyes =
    talents?.resources.find((resource) => resource.type === 'FALLEN_ELF_EYE')
      ?.amount ?? 0
  const darkPriestAsh =
    talents?.resources.find((resource) => resource.type === 'DARK_PRIEST_ASH')
      ?.amount ?? 0
  const activeSection: GameSection = {
    HUB: 'LOBBY',
    TRAINING: 'CHARACTER',
    CRAFTING: 'CRAFTING',
    TEMPERING: 'CRAFTING',
    FRONT: 'MAP',
    CLAN: 'CLAN',
    MARKET: 'LOBBY',
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
      pageTitle={cityDistrictName(district)}
      pageSubtitle="Попелястий Прихисток"
      hideWorldSidebar={district === 'MARKET'}
      onNavigate={navigate}
    >
      <section
        className={`mx-auto w-full max-w-[96rem] border border-border/70 bg-panel/80 p-3 shadow-2xl shadow-black/25 sm:p-4 ${gameUi.pageGap}`}
      >
        {district === 'HUB' ? (
          <>
            <GameHeroBanner
              eyebrow="Попелястий край · нейтральний хаб"
              title={
                <>
                  Попелястий Прихисток{' '}
                  <Flame className="inline size-5 text-ember" />
                </>
              }
              subtitle="Перше велике місто за Зламаною заставою"
              description={
                <p>
                  Тут таланти стають ремеслом, спорядження — силою, а союзи —
                  щитом у війні. Зала гарту, зброярня, майстерня, воєнна рада,
                  клановий двір і торгові ряди зібрані в єдиному міському вузлі.
                </p>
              }
              footer={
                <dl className="flex flex-wrap gap-8 text-xs">
                  <div>
                    <dt className="font-mono text-[0.55rem] uppercase text-muted-foreground">
                      Статус міста
                    </dt>
                    <dd className="mt-1 text-moss">Нейтральний</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.55rem] uppercase text-muted-foreground">
                      Контроль
                    </dt>
                    <dd className="mt-1">Скриптовий фронт</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.55rem] uppercase text-muted-foreground">
                      Служби
                    </dt>
                    <dd className="mt-1 text-ember">6 доступно</dd>
                  </div>
                </dl>
              }
              aside={
                <>
                  <p className="font-mono text-[0.58rem] uppercase tracking-wider text-ember">
                    Ваш прогрес
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-px bg-border/60">
                    <GameMetric label="Рівень" value={hero.level} />
                    <GameMetric
                      label="Сила"
                      value={inventory?.totalDamage ?? hero.baseStats.damage}
                    />
                    <GameMetric
                      label="Досвід"
                      value={hero.experienceIntoLevel}
                    />
                    <GameMetric
                      label="До рівня"
                      value={hero.experienceForNextLevel}
                    />
                  </dl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenProfile}
                    className="mt-3 h-8 w-full rounded-sm text-xs"
                  >
                    Перегляд персонажа <ArrowRight />
                  </Button>
                </>
              }
            />
            <GamePanel eyebrow="Міські квартали" title="Куди вирушити?">
              <GamePosterGrid>
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
                  icon={Hammer}
                  title="Висока кузня"
                  description="Довге гартування легендарного спорядження рідкісними каменями Завіси."
                  action="Відкрити ковадло"
                  onClick={() => setDistrict('TEMPERING')}
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
                  description="Анонімні 24-годинні оголошення, продаж спорядження та розрахунки Відгомоном Завіси."
                  action="Відкрити майданчик"
                  onClick={() => setDistrict('MARKET')}
                />
              </GamePosterGrid>
            </GamePanel>
            <GamePanel eyebrow="Приховані виклики" title="Шляхи Завіси">
              <GamePosterGrid>
                <CityDistrict
                  icon={Compass}
                  title="Брама до Лісу дріад"
                  description="Новий похід на 70 етапів. На 35-му рубежі Кореневий форпост захищає група ворогів."
                  action="Вирушити до лісу"
                  onClick={onEnterDryadForest}
                />
                <CityDistrict
                  icon={Sparkles}
                  title="Ритуальне коло"
                  description={
                    hero.level < 30
                      ? 'Закриті знання. Ритуал відкривається героям 30 рівня.'
                      : invocationSeals > 0
                        ? `Печаток у сховищі: ${invocationSeals}. Викликати Проклятого лицаря Морґрейва.`
                        : 'Для виклику потрібна печатка, здобута у рідкісного носія на Порожній дорозі.'
                  }
                  action={
                    invocationSeals > 0 && hero.level >= 30
                      ? 'Розпочати ритуал'
                      : 'Ритуал недоступний'
                  }
                  locked={hero.level < 30 || invocationSeals < 1}
                  onClick={onInvokeCursedKnight}
                />
                <CityDistrict
                  icon={Eye}
                  title="Заборонений гай"
                  description={
                    cursedHearts >= 3
                      ? `Сердець у сховищі: ${cursedHearts}. Спалити три й викликати Павшого ельфа Саеліра.`
                      : `Зберіть три Серця Проклятого лицаря. Зараз у сховищі: ${cursedHearts}.`
                  }
                  action={
                    cursedHearts >= 3
                      ? 'Викликати Павшого ельфа'
                      : 'Потрібно 3 серця'
                  }
                  locked={hero.level < 30 || cursedHearts < 3}
                  onClick={onInvokeFallenElf}
                />
                <CityDistrict
                  icon={Flame}
                  title="Крипта Темного жерця"
                  description={
                    darkPriestSeals > 0
                      ? `Перекованих печаток: ${darkPriestSeals}. Нервал чекає за межею ритуального кола.`
                      : 'Перекуйте звичайну печатку в майстерні, щоб обрати альтернативну гілку виклику.'
                  }
                  action={
                    darkPriestSeals > 0
                      ? 'Викликати Темного жерця'
                      : 'Потрібна перекована печатка'
                  }
                  locked={hero.level < 30 || darkPriestSeals < 1}
                  onClick={onInvokeDarkPriest}
                />
                <CityDistrict
                  icon={Sparkles}
                  title="Розлом Завіси · шлях очей"
                  description={`Три Ока Павшого ельфа відкриють шлях до Вартового. У сховищі: ${fallenElfEyes}. Перемога гарантує божественну реліквію.`}
                  action={
                    fallenElfEyes >= 3
                      ? 'Відкрити розлом очима'
                      : 'Потрібно 3 ока'
                  }
                  locked={hero.level < 30 || fallenElfEyes < 3}
                  onClick={onInvokeVeilWardenFromEyes}
                />
                <CityDistrict
                  icon={Flame}
                  title="Розлом Завіси · шлях попелу"
                  description={`Три Попели Темного жерця відкриють альтернативний шлях до того самого Вартового. У сховищі: ${darkPriestAsh}.`}
                  action={
                    darkPriestAsh >= 3
                      ? 'Відкрити розлом попелом'
                      : 'Потрібно 3 попели'
                  }
                  locked={hero.level < 30 || darkPriestAsh < 3}
                  onClick={onInvokeVeilWardenFromAsh}
                />
              </GamePosterGrid>
            </GamePanel>
            <section className="grid gap-px bg-border/60 md:grid-cols-3">
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
          <CraftingWorkshop
            onBack={() => setDistrict('HUB')}
            onOpenTempering={() => setDistrict('TEMPERING')}
          />
        ) : district === 'TEMPERING' ? (
          <TemperingForge
            items={[
              ...(inventory?.chest ?? []),
              ...(inventory?.equipped.map((entry) => entry.item) ?? []),
            ]}
            onBack={() => setDistrict('CRAFTING')}
            onChanged={onRefresh}
          />
        ) : district === 'MARKET' ? (
          <Marketplace
            inventory={inventory}
            resources={talents?.resources ?? []}
            onBack={() => setDistrict('HUB')}
          />
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
    <GameServiceCard
      icon={Icon}
      title={title}
      description={description}
      action={action}
      status={locked ? 'Недоступно' : 'Доступно'}
      locked={locked}
      onClick={onClick}
    />
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
  region = 'HOLLOW_ROAD',
}: {
  hero: Hero
  preparation: Preparation | null
  region?: 'HOLLOW_ROAD' | 'DRYAD_FOREST'
}) {
  return (
    <BattleEncounter
      heroName={hero.name}
      preparation={preparationName(preparation)}
      region={region}
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
  onOpenInventory,
  onUnequip,
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
  onOpenInventory: () => void
  onUnequip: (slot: EquipmentSlotKey) => void
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
}) {
  const weapon = inventory.equipped.find(
    (entry) => entry.slot === 'MAIN_HAND',
  )?.item
  const equippedBySlot = new Map(
    inventory.equipped.map((entry) => [entry.slot, entry.item]),
  )
  const equippedItems = inventory.equipped.map((entry) => entry.item)
  const equipmentPower = equippedItems.reduce(
    (sum, item) => sum + inventoryItemPower(item),
    0,
  )
  const averageQuality = equippedItems.length
    ? Math.round(
        equippedItems.reduce((sum, item) => sum + item.rollQuality, 0) /
          equippedItems.length,
      )
    : 0
  const experienceProgress = Math.min(
    100,
    Math.round(
      (hero.experienceIntoLevel / Math.max(hero.experienceForNextLevel, 1)) *
        100,
    ),
  )
  const setProgress = Array.from(
    equippedItems.reduce((sets, item) => {
      if (!item.setName) return sets
      sets.set(item.setName, (sets.get(item.setName) ?? 0) + 1)
      return sets
    }, new Map<string, number>()),
  ).sort((left, right) => right[1] - left[1])

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
        onUnequip={onUnequip}
      />
    )

  return (
    <section className="mx-auto w-full max-w-[96rem] border border-border/70 bg-panel/60">
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
      <dl className="grid border-b border-border/70 bg-background/30 sm:grid-cols-2 xl:grid-cols-5">
        <ProfileMetric
          label="Рівень"
          value={hero.level}
          detail={`${experienceProgress}% до наступного`}
        />
        <ProfileMetric
          label="Сила спорядження"
          value={equipmentPower}
          detail={`${inventory.equipped.length}/14 слотів`}
        />
        <ProfileMetric
          label="Загальний DMG"
          value={inventory.totalDamage}
          detail={`база ${inventory.baseDamage}`}
        />
        <ProfileMetric
          label="Захист"
          value={inventory.totalArmor}
          detail={`база ${inventory.baseArmor}`}
        />
        <ProfileMetric
          label="Якість спорядження"
          value={`${averageQuality}%`}
          detail={setProgress[0]?.[0] ?? 'Без активного сету'}
        />
      </dl>
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
              <EquipmentSlot
                label="Шолом"
                slot="HEAD"
                item={equippedBySlot.get('HEAD')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Наплечники"
                slot="SHOULDERS"
                item={equippedBySlot.get('SHOULDERS')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Нагрудник"
                slot="CHEST"
                item={equippedBySlot.get('CHEST')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Наручі"
                slot="BRACERS"
                item={equippedBySlot.get('BRACERS')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Рукавиці"
                slot="HANDS"
                item={equippedBySlot.get('HANDS')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Штани"
                slot="LEGS"
                item={equippedBySlot.get('LEGS')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Черевики"
                slot="FEET"
                item={equippedBySlot.get('FEET')}
                pending={pending}
                onUnequip={onUnequip}
              />
            </div>
            <div className="flex min-h-80 flex-col items-center justify-center border-x border-ember/20 bg-background/25 px-3">
              <div className="grid size-20 place-items-center rounded-full border border-ember/60 bg-ember/10 shadow-[0_0_3rem_oklch(0.55_0.12_55/20%)]">
                <Shield className="size-10 text-ember" aria-hidden="true" />
              </div>
              <div className="mt-5 h-36 w-24 border border-border/80 bg-panel/80 [clip-path:polygon(15%_0,85%_0,100%_100%,0_100%)]" />
              <div className="mt-3 w-full">
                <EquipmentSlot
                  label="Основна рука"
                  slot="MAIN_HAND"
                  item={weapon}
                  pending={pending}
                  onUnequip={onUnequip}
                />
                <p className="mt-2 text-center font-mono text-[0.58rem] uppercase tracking-wider text-ember">
                  {weapon ? `+${weapon.damage} DMG` : 'Без зброї'}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <EquipmentSlot
                label="Амулет"
                slot="AMULET"
                item={equippedBySlot.get('AMULET')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Браслет"
                slot="BRACELET"
                item={equippedBySlot.get('BRACELET')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Каблучка I"
                slot="RING_LEFT"
                item={equippedBySlot.get('RING_LEFT')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Каблучка II"
                slot="RING_RIGHT"
                item={equippedBySlot.get('RING_RIGHT')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Пояс"
                slot="WAIST"
                item={equippedBySlot.get('WAIST')}
                pending={pending}
                onUnequip={onUnequip}
              />
              <EquipmentSlot
                label="Друга рука"
                slot="OFF_HAND"
                item={equippedBySlot.get('OFF_HAND')}
                pending={pending}
                onUnequip={onUnequip}
              />
            </div>
          </div>
          <p className="relative mt-5 text-center text-xs text-muted-foreground">
            {inventory.mainHandVisualAssetId ?? 'Базовий вигляд без зброї'}
          </p>
          <div className="relative mx-auto mt-5 max-w-xl border border-border/70 bg-background/45 p-3">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Досвід героя</span>
              <span className="font-mono">
                {hero.experienceIntoLevel}/{hero.experienceForNextLevel} XP
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden bg-border/70">
              <div
                className="h-full bg-ember"
                style={{ width: `${experienceProgress}%` }}
              />
            </div>
          </div>
        </section>
        <aside className="p-5">
          <ProfileSummary
            hero={hero}
            inventory={inventory}
            talents={talents}
            clan={clan}
            weapon={weapon}
            averageQuality={averageQuality}
            setProgress={setProgress}
            onOpenInventory={onOpenInventory}
          />
        </aside>
      </div>
    </section>
  )
}

function EquipmentSlot({
  label,
  slot,
  item,
  pending,
  onUnequip,
}: {
  label: string
  slot: EquipmentSlotKey
  item?: InventoryItem
  pending: boolean
  onUnequip: (slot: EquipmentSlotKey) => void
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
          <>
            <p className="mt-1 truncate text-[0.58rem] text-foreground">
              {item.name}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => onUnequip(slot)}
              aria-label={`Зняти ${item.name} зі слота ${label.toLocaleLowerCase('uk-UA')}`}
              title={`Повернути «${item.name}» у сундук`}
              className="mt-1 font-mono text-[0.5rem] uppercase text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Зняти
            </button>
          </>
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
  onUnequip,
}: {
  hero: Hero
  inventory: Inventory
  locationName: string
  pending: boolean
  error: string | null
  onBack: () => void
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
  onUnequip: (slot: EquipmentSlotKey) => void
}) {
  const equippedBySlot = new Map(
    inventory.equipped.map((entry) => [entry.slot, entry.item]),
  )
  const loot = [...inventory.chest, ...inventory.backpack].filter(
    (item, index, items) =>
      items.findIndex((entry) => entry.id === item.id) === index,
  )
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    loot[0]?.id ?? null,
  )
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategory, setInventoryCategory] =
    useState<InventoryCategory>('ALL')
  const [inventoryRarity, setInventoryRarity] = useState('ALL')
  const [inventorySort, setInventorySort] = useState<InventorySort>('POWER')
  const [inventoryScope, setInventoryScope] = useState<InventoryScope>('ALL')
  const [inventoryUsability, setInventoryUsability] =
    useState<InventoryUsability>('ALL')
  const [inventoryDirection, setInventoryDirection] =
    useState<InventoryDirection>('DESC')
  const [inventoryDensity, setInventoryDensity] =
    useState<InventoryDensity>('COMFORTABLE')
  const [inventorySet, setInventorySet] = useState('ALL')
  const [minimumLevel, setMinimumLevel] = useState(1)
  const [maximumLevel, setMaximumLevel] = useState(99)
  const [minimumQuality, setMinimumQuality] = useState(0)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [favoriteItemIds, setFavoriteItemIds] = useState<string[]>([])
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventoryPageSize, setInventoryPageSize] = useState<number>(
    inventoryItemsPerPage,
  )
  const chestItemIds = new Set(inventory.chest.map((item) => item.id))
  const backpackItemIds = new Set(inventory.backpack.map((item) => item.id))
  const availableSets = [
    ...new Set(loot.map((item) => item.setName).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right, 'uk'))
  const search = inventorySearch.trim().toLocaleLowerCase('uk')
  const filteredLoot = loot
    .filter(
      (item) =>
        inventoryScope === 'ALL' ||
        (inventoryScope === 'CHEST' && chestItemIds.has(item.id)) ||
        (inventoryScope === 'BACKPACK' && backpackItemIds.has(item.id)),
    )
    .filter(
      (item) =>
        inventoryCategory === 'ALL' ||
        inventoryItemCategory(item) === inventoryCategory,
    )
    .filter(
      (item) => inventoryRarity === 'ALL' || item.rarity === inventoryRarity,
    )
    .filter(
      (item) =>
        inventoryUsability === 'ALL' ||
        (inventoryUsability === 'USABLE' && item.itemLevel <= hero.level) ||
        (inventoryUsability === 'LOCKED' && item.itemLevel > hero.level),
    )
    .filter(
      (item) =>
        item.itemLevel >= minimumLevel && item.itemLevel <= maximumLevel,
    )
    .filter(
      (item) => Math.round((item.rollQuality / 9_999) * 100) >= minimumQuality,
    )
    .filter((item) => inventorySet === 'ALL' || item.setName === inventorySet)
    .filter((item) => !favoriteOnly || favoriteItemIds.includes(item.id))
    .filter(
      (item) =>
        !search ||
        item.name.toLocaleLowerCase('uk').includes(search) ||
        item.setName.toLocaleLowerCase('uk').includes(search),
    )
    .sort((left, right) => {
      const comparison = compareInventoryItems(left, right, inventorySort)
      return inventoryDirection === 'DESC' ? comparison : -comparison
    })
  const inventoryPageCount = Math.max(
    1,
    Math.ceil(filteredLoot.length / inventoryPageSize),
  )
  const currentInventoryPage = Math.min(inventoryPage, inventoryPageCount)
  const pagedLoot = filteredLoot.slice(
    (currentInventoryPage - 1) * inventoryPageSize,
    currentInventoryPage * inventoryPageSize,
  )
  const selectedItem =
    filteredLoot.find((item) => item.id === selectedItemId) ??
    filteredLoot[0] ??
    null
  const rarityBreakdown = Object.keys(INVENTORY_RARITY_ORDER)
    .map((rarity) => ({
      rarity,
      count: filteredLoot.filter((item) => item.rarity === rarity).length,
    }))
    .filter((entry) => entry.count > 0)
  const activeFilterLabels = [
    inventorySearch ? `Пошук: ${inventorySearch}` : null,
    inventoryScope !== 'ALL'
      ? inventoryScope === 'CHEST'
        ? 'Сундук'
        : 'Рюкзак'
      : null,
    inventoryCategory !== 'ALL'
      ? inventoryCategory === 'WEAPON'
        ? 'Зброя'
        : inventoryCategory === 'ARMOR'
          ? 'Броня'
          : 'Аксесуари'
      : null,
    inventoryRarity !== 'ALL' ? itemRarityName(inventoryRarity) : null,
    inventoryUsability !== 'ALL'
      ? inventoryUsability === 'USABLE'
        ? 'Доступні за рівнем'
        : 'Вище рівня'
      : null,
    inventorySet !== 'ALL' ? inventorySet : null,
    minimumLevel > 1 || maximumLevel < 99
      ? `Рівні ${minimumLevel}–${maximumLevel}`
      : null,
    minimumQuality > 0 ? `Якість від ${minimumQuality}%` : null,
    favoriteOnly ? 'Лише обрані' : null,
  ].filter((label): label is string => Boolean(label))
  const favoriteCount = loot.filter((item) =>
    favoriteItemIds.includes(item.id),
  ).length
  const selectedSetProgress = selectedItem?.setName
    ? {
        owned: loot.filter((item) => item.setName === selectedItem.setName)
          .length,
        equipped: inventory.equipped.filter(
          (entry) => entry.item.setName === selectedItem.setName,
        ).length,
      }
    : null

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(inventoryViewKey)
        if (!stored) return
        const view = JSON.parse(stored) as {
          category?: InventoryCategory
          rarity?: string
          sort?: InventorySort
          scope?: InventoryScope
          usability?: InventoryUsability
          direction?: InventoryDirection
          density?: InventoryDensity
          set?: string
          minimumLevel?: number
          maximumLevel?: number
          minimumQuality?: number
          favoriteOnly?: boolean
          selectedItemId?: string
          pageSize?: number
        }
        setInventoryCategory(view.category ?? 'ALL')
        setInventoryRarity(view.rarity ?? 'ALL')
        setInventorySort(view.sort ?? 'POWER')
        setInventoryScope(view.scope ?? 'ALL')
        setInventoryUsability(view.usability ?? 'ALL')
        setInventoryDirection(view.direction ?? 'DESC')
        setInventoryDensity(view.density ?? 'COMFORTABLE')
        setInventorySet(view.set ?? 'ALL')
        setMinimumLevel(view.minimumLevel ?? 1)
        setMaximumLevel(view.maximumLevel ?? 99)
        setMinimumQuality(view.minimumQuality ?? 0)
        setFavoriteOnly(view.favoriteOnly ?? false)
        setSelectedItemId(view.selectedItemId ?? null)
        setInventoryPageSize(
          inventoryPageSizes.includes(
            view.pageSize as (typeof inventoryPageSizes)[number],
          )
            ? (view.pageSize as number)
            : inventoryItemsPerPage,
        )
      } catch {
        window.localStorage.removeItem(inventoryViewKey)
      }
    }, 0)
    return () => window.clearTimeout(restore)
  }, [])

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(favoriteItemsKey)
        if (stored) setFavoriteItemIds(JSON.parse(stored) as string[])
      } catch {
        window.localStorage.removeItem(favoriteItemsKey)
      }
    }, 0)
    return () => window.clearTimeout(restore)
  }, [])

  function updateInventoryView(next: {
    category?: InventoryCategory
    rarity?: string
    sort?: InventorySort
    scope?: InventoryScope
    usability?: InventoryUsability
    direction?: InventoryDirection
    density?: InventoryDensity
    set?: string
    minimumLevel?: number
    maximumLevel?: number
    minimumQuality?: number
    favoriteOnly?: boolean
    selectedItemId?: string | null
    pageSize?: number
  }) {
    const current = {
      category: inventoryCategory,
      rarity: inventoryRarity,
      sort: inventorySort,
      scope: inventoryScope,
      usability: inventoryUsability,
      direction: inventoryDirection,
      density: inventoryDensity,
      set: inventorySet,
      minimumLevel,
      maximumLevel,
      minimumQuality,
      favoriteOnly,
      selectedItemId,
      pageSize: inventoryPageSize,
    }
    window.localStorage.setItem(
      inventoryViewKey,
      JSON.stringify({ ...current, ...next }),
    )
    setInventoryPage(1)
  }

  function selectInventoryItem(itemId: string) {
    setSelectedItemId(itemId)
    updateInventoryView({ selectedItemId: itemId })
  }

  function toggleFavoriteItem(itemId: string) {
    setFavoriteItemIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
      window.localStorage.setItem(favoriteItemsKey, JSON.stringify(next))
      return next
    })
  }

  function resetInventoryFilters() {
    setInventorySearch('')
    setInventoryCategory('ALL')
    setInventoryRarity('ALL')
    setInventoryScope('ALL')
    setInventoryUsability('ALL')
    setInventorySet('ALL')
    setMinimumLevel(1)
    setMaximumLevel(99)
    setMinimumQuality(0)
    setFavoriteOnly(false)
    updateInventoryView({
      category: 'ALL',
      rarity: 'ALL',
      scope: 'ALL',
      usability: 'ALL',
      set: 'ALL',
      minimumLevel: 1,
      maximumLevel: 99,
      minimumQuality: 0,
      favoriteOnly: false,
    })
  }

  function selectRelativeItem(offset: number) {
    if (!selectedItem || filteredLoot.length < 2) return
    const currentIndex = filteredLoot.findIndex(
      (item) => item.id === selectedItem.id,
    )
    const nextIndex =
      (currentIndex + offset + filteredLoot.length) % filteredLoot.length
    selectInventoryItem(filteredLoot[nextIndex]!.id)
    setInventoryPage(Math.floor(nextIndex / inventoryPageSize) + 1)
  }

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

        <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inventorySearch}
              onChange={(event) => {
                setInventorySearch(event.target.value)
                setInventoryPage(1)
              }}
              placeholder="Пошук предмета або комплекту…"
              className="h-9 rounded-sm pl-9"
            />
            {inventorySearch ? (
              <button
                type="button"
                onClick={() => {
                  setInventorySearch('')
                  setInventoryPage(1)
                }}
                aria-label="Очистити пошук"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            ) : null}
          </label>
          <select
            value={inventoryRarity}
            onChange={(event) => {
              setInventoryRarity(event.target.value)
              updateInventoryView({ rarity: event.target.value })
            }}
            aria-label="Рідкість предметів"
            className="h-9 border border-border/70 bg-background px-3 text-xs outline-none"
          >
            <option value="ALL">Усі рідкості</option>
            {Object.keys(INVENTORY_RARITY_ORDER).map((rarity) => (
              <option key={rarity} value={rarity}>
                {itemRarityName(rarity)}
              </option>
            ))}
          </select>
          <select
            value={inventorySort}
            onChange={(event) => {
              const next = event.target.value as InventorySort
              setInventorySort(next)
              updateInventoryView({ sort: next })
            }}
            aria-label="Сортування інвентарю"
            className="h-9 border border-border/70 bg-background px-3 text-xs outline-none"
          >
            <option value="POWER">За силою</option>
            <option value="LEVEL">За рівнем</option>
            <option value="RARITY">За рідкістю</option>
            <option value="NAME">За назвою</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = inventoryDirection === 'DESC' ? 'ASC' : 'DESC'
              setInventoryDirection(next)
              updateInventoryView({ direction: next })
            }}
            className="h-9 rounded-sm px-3 text-xs lg:col-start-3"
          >
            {inventoryDirection === 'DESC' ? '↓ Спадання' : '↑ Зростання'}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-y border-border/60 py-2">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['ALL', `Усе · ${loot.length}`],
                ['CHEST', `Сундук · ${inventory.chest.length}`],
                ['BACKPACK', `Рюкзак · ${inventory.backpack.length}`],
              ] as const
            ).map(([scope, label]) => (
              <Button
                key={scope}
                type="button"
                variant={inventoryScope === scope ? 'secondary' : 'ghost'}
                onClick={() => {
                  setInventoryScope(scope)
                  updateInventoryView({ scope })
                }}
                className="h-7 rounded-sm px-2 text-[0.65rem]"
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            {(
              [
                ['ALL', 'Усі рівні'],
                ['USABLE', 'Можна вдягнути'],
                ['LOCKED', 'Вище рівня'],
              ] as const
            ).map(([usability, label]) => (
              <Button
                key={usability}
                type="button"
                variant={
                  inventoryUsability === usability ? 'secondary' : 'ghost'
                }
                onClick={() => {
                  setInventoryUsability(usability)
                  updateInventoryView({ usability })
                }}
                className="h-7 rounded-sm px-2 text-[0.65rem]"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(
            [
              ['ALL', 'Усі предмети'],
              ['WEAPON', 'Зброя'],
              ['ARMOR', 'Броня'],
              ['ACCESSORY', 'Аксесуари'],
            ] as const
          ).map(([category, label]) => (
            <Button
              key={category}
              type="button"
              variant={inventoryCategory === category ? 'secondary' : 'outline'}
              onClick={() => {
                setInventoryCategory(category)
                updateInventoryView({ category })
              }}
              className="h-8 rounded-none px-3 text-xs"
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            variant={favoriteOnly ? 'secondary' : 'outline'}
            onClick={() => {
              const next = !favoriteOnly
              setFavoriteOnly(next)
              updateInventoryView({ favoriteOnly: next })
            }}
            className="h-8 rounded-none px-3 text-xs"
          >
            <Star
              className={`size-3.5 ${favoriteOnly ? 'fill-ember text-ember' : ''}`}
            />
            Обрані
          </Button>
        </div>
        <details className="mt-2 border border-border/60 bg-background/30 p-3">
          <summary className="cursor-pointer font-mono text-[0.62rem] uppercase text-muted-foreground">
            Додаткові фільтри та вигляд
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs text-muted-foreground">
              Комплект
              <select
                value={inventorySet}
                onChange={(event) => {
                  setInventorySet(event.target.value)
                  updateInventoryView({ set: event.target.value })
                }}
                className="mt-1 h-9 w-full border border-border/70 bg-background px-2 text-foreground outline-none"
              >
                <option value="ALL">Усі комплекти</option>
                {availableSets.map((setName) => (
                  <option key={setName} value={setName}>
                    {setName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Рівень від
              <Input
                type="number"
                min={1}
                max={99}
                value={minimumLevel}
                onChange={(event) => {
                  const next = Math.min(
                    99,
                    Math.max(1, Number(event.target.value) || 1),
                  )
                  setMinimumLevel(next)
                  updateInventoryView({ minimumLevel: next })
                }}
                className="mt-1 h-9 rounded-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Рівень до
              <Input
                type="number"
                min={1}
                max={99}
                value={maximumLevel}
                onChange={(event) => {
                  const next = Math.min(
                    99,
                    Math.max(1, Number(event.target.value) || 99),
                  )
                  setMaximumLevel(next)
                  updateInventoryView({ maximumLevel: next })
                }}
                className="mt-1 h-9 rounded-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Якість від, %
              <Input
                type="number"
                min={0}
                max={100}
                value={minimumQuality}
                onChange={(event) => {
                  const next = Math.min(
                    100,
                    Math.max(0, Number(event.target.value) || 0),
                  )
                  setMinimumQuality(next)
                  updateInventoryView({ minimumQuality: next })
                }}
                className="mt-1 h-9 rounded-sm"
              />
            </label>
            <div className="flex flex-col justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next =
                    inventoryDensity === 'COMFORTABLE'
                      ? 'COMPACT'
                      : 'COMFORTABLE'
                  setInventoryDensity(next)
                  updateInventoryView({ density: next })
                }}
                className="h-9 rounded-sm text-xs"
              >
                {inventoryDensity === 'COMFORTABLE'
                  ? 'Щільна сітка'
                  : 'Звичайна сітка'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetInventoryFilters}
                className="h-7 rounded-sm text-[0.62rem]"
              >
                Очистити фільтри
              </Button>
            </div>
          </div>
        </details>
        {activeFilterLabels.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[0.55rem] uppercase text-muted-foreground">
              Активні:
            </span>
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="border border-ember/25 bg-ember/5 px-2 py-1 text-[0.62rem] text-ember"
              >
                {label}
              </span>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={resetInventoryFilters}
              className="h-7 rounded-sm px-2 text-[0.62rem]"
            >
              Скинути все
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-px border-b border-border/70 bg-border/60 sm:grid-cols-4">
        <InventoryInsight label="Знайдено" value={filteredLoot.length} />
        <InventoryInsight
          label="Сумарна сила"
          value={filteredLoot.reduce(
            (sum, item) => sum + inventoryItemPower(item),
            0,
          )}
        />
        <InventoryInsight
          label="Рідкісності"
          value={
            rarityBreakdown
              .map((entry) => `${itemRarityName(entry.rarity)}: ${entry.count}`)
              .join(' · ') || '—'
          }
        />
        <InventoryInsight
          label="Обрані"
          value={`${favoriteCount}/${loot.length}`}
        />
      </div>

      <details className="border-b border-border/70 bg-background/25" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-background/40 sm:px-5">
          <span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ember">
              Споряджено на герої
            </span>
            <span className="ml-3 text-xs text-muted-foreground">
              {inventory.equipped.length}/14 слотів
            </span>
          </span>
          <span className="font-mono text-[0.55rem] uppercase text-muted-foreground">
            Керування слотами
          </span>
        </summary>
        <div className="grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {(Object.keys(EQUIPMENT_SLOT_NAMES) as EquipmentSlotKey[]).map(
            (slot) => {
              const item = equippedBySlot.get(slot)
              const activeBonuses = item
                ? inventory.activeSetBonuses.filter(
                    (bonus) => bonus.setId === item.setId,
                  ).length
                : 0
              return (
                <EquippedInventorySlot
                  key={slot}
                  slot={slot}
                  item={item}
                  activeBonuses={activeBonuses}
                  pending={pending}
                  onUnequip={onUnequip}
                />
              )
            },
          )}
        </div>
      </details>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 p-4 sm:p-5">
          {filteredLoot.length === 0 ? (
            <div className="grid min-h-72 place-items-center border border-dashed border-border/70 bg-background/25 p-8 text-center">
              <div>
                <Package
                  className="mx-auto size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-3 font-medium">
                  {loot.length === 0
                    ? 'Сундук порожній'
                    : 'Предметів не знайдено'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loot.length === 0
                    ? 'Перенесіть сюди здобич після повернення з походу.'
                    : 'Змініть пошук, категорію або рідкість.'}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={
                inventoryDensity === 'COMPACT'
                  ? 'grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-6'
                  : 'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5'
              }
            >
              {pagedLoot.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  equippedBySlot={equippedBySlot}
                  selected={item.id === selectedItem?.id}
                  scope={chestItemIds.has(item.id) ? 'CHEST' : 'BACKPACK'}
                  favorite={favoriteItemIds.includes(item.id)}
                  compact={inventoryDensity === 'COMPACT'}
                  heroLevel={hero.level}
                  onSelect={() => selectInventoryItem(item.id)}
                  onToggleFavorite={() => toggleFavoriteItem(item.id)}
                />
              ))}
            </div>
          )}
          {filteredLoot.length > 0 ? (
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
              <span className="text-muted-foreground">
                Показано {(currentInventoryPage - 1) * inventoryPageSize + 1}–
                {Math.min(
                  currentInventoryPage * inventoryPageSize,
                  filteredLoot.length,
                )}{' '}
                із {filteredLoot.length}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={inventoryPageSize}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setInventoryPageSize(next)
                    setInventoryPage(1)
                    updateInventoryView({ pageSize: next })
                  }}
                  aria-label="Предметів на сторінці"
                  className="h-7 border border-border/70 bg-background px-2 text-xs outline-none"
                >
                  {inventoryPageSizes.map((size) => (
                    <option key={size} value={size}>
                      {size} на сторінці
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentInventoryPage === 1}
                  onClick={() =>
                    setInventoryPage((page) => Math.max(1, page - 1))
                  }
                  className="h-7 rounded-sm"
                >
                  Назад
                </Button>
                <span className="font-mono">
                  {currentInventoryPage}/{inventoryPageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentInventoryPage === inventoryPageCount}
                  onClick={() =>
                    setInventoryPage((page) =>
                      Math.min(inventoryPageCount, page + 1),
                    )
                  }
                  className="h-7 rounded-sm"
                >
                  Далі
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-4 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
        <aside className="border-t border-border/70 bg-background/35 p-4 lg:border-t-0 lg:border-l">
          <InventoryItemDetails
            key={selectedItem?.id ?? 'empty'}
            hero={hero}
            item={selectedItem}
            equippedBySlot={equippedBySlot}
            pending={pending}
            onEquip={onEquip}
            setProgress={selectedSetProgress}
            setBonusProgress={inventory.setBonusProgress}
            equippedItems={inventory.equipped}
            onPrevious={() => selectRelativeItem(-1)}
            onNext={() => selectRelativeItem(1)}
          />
        </aside>
      </div>
    </section>
  )
}

function EquippedInventorySlot({
  slot,
  item,
  activeBonuses,
  pending,
  onUnequip,
}: {
  slot: EquipmentSlotKey
  item?: InventoryItem
  activeBonuses: number
  pending: boolean
  onUnequip: (slot: EquipmentSlotKey) => void
}) {
  return (
    <article className="min-w-0 bg-panel/85 p-2.5">
      <p className="font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">
        {EQUIPMENT_SLOT_NAMES[slot]}
      </p>
      {item ? (
        <>
          <p className="mt-1 truncate text-xs" title={item.name}>
            {item.name}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[0.52rem]">
            <span className="text-ember">{itemRarityName(item.rarity)}</span>
            <span className="text-muted-foreground">
              {inventoryItemPower(item)} сили
            </span>
          </div>
          {item.temperingStage > 0 ? (
            <p className="mt-1 font-mono text-[0.55rem] text-ember">
              Гарт +{item.temperingStage}
            </p>
          ) : null}
          {activeBonuses > 0 ? (
            <p className="mt-1 text-[0.55rem] text-moss">
              Активних бонусів сету: {activeBonuses}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onUnequip(slot)}
            className="mt-2 h-7 w-full rounded-sm text-[0.58rem] text-muted-foreground hover:text-destructive"
          >
            Зняти в сундук
          </Button>
        </>
      ) : (
        <div className="mt-2 grid min-h-16 place-items-center border border-dashed border-border/60 text-[0.58rem] text-muted-foreground">
          Порожньо
        </div>
      )}
    </article>
  )
}

function InventoryItemCard({
  item,
  equippedBySlot,
  selected,
  scope,
  favorite,
  compact,
  heroLevel,
  onSelect,
  onToggleFavorite,
}: {
  item: InventoryItem
  equippedBySlot: ReadonlyMap<EquipmentSlotKey, InventoryItem>
  selected: boolean
  scope: Exclude<InventoryScope, 'ALL'>
  favorite: boolean
  compact: boolean
  heroLevel: number
  onSelect: () => void
  onToggleFavorite: () => void
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
  const totalDelta = statDeltas.reduce((sum, [, delta]) => sum + delta, 0)

  return (
    <article
      role="button"
      aria-pressed={selected}
      aria-label={`${item.name}, ${itemRarityName(item.rarity)}, ${item.itemLevel} рівень`}
      tabIndex={0}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      className={`relative flex cursor-pointer flex-col border bg-background/45 outline-none transition ${compact ? 'min-h-36 p-2' : 'min-h-44 p-3'} ${selected ? 'border-ember/70 bg-ember/5' : 'border-border/70 hover:border-ember/40'}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite()
        }}
        aria-label={favorite ? 'Прибрати з обраних' : 'Додати до обраних'}
        className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-ember"
      >
        <Star className={`size-4 ${favorite ? 'fill-ember text-ember' : ''}`} />
      </button>
      <div className="flex items-start gap-2">
        <div className="grid size-10 shrink-0 place-items-center border border-ember/45 bg-ember/5">
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
            {item.temperingStage > 0 ? ` · гарт +${item.temperingStage}` : ''}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {item.setName}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[0.58rem]">
        <span
          className={
            item.itemLevel <= heroLevel ? 'text-moss' : 'text-destructive'
          }
        >
          {item.itemLevel <= heroLevel
            ? 'Можна вдягнути'
            : `Потрібен ${item.itemLevel} рівень`}
        </span>
        <span className={`font-mono ${deltaColor(totalDelta)}`}>
          {totalDelta > 0
            ? 'Покращення'
            : totalDelta < 0
              ? 'Слабше'
              : 'Рівноцінне'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px bg-border/60 text-[0.65rem]">
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
      <div className="mt-2 grid grid-cols-3 gap-1 text-[0.62rem]">
        {statDeltas.map(([label, delta]) => (
          <div key={label} className="flex justify-between gap-1">
            <span className="text-muted-foreground">{label}</span>
            <span className={`font-mono ${deltaColor(delta)}`}>
              {formatDelta(delta)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-auto flex justify-between gap-2 pt-3 font-mono text-[0.55rem] uppercase text-muted-foreground">
        <span>{scope === 'CHEST' ? 'Сундук' : 'Рюкзак'}</span>
        <span>Деталі</span>
      </p>
    </article>
  )
}

function InventoryInsight({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="bg-background/55 px-4 py-3">
      <p className="font-mono text-[0.55rem] uppercase text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 truncate text-xs text-foreground"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function InventoryItemDetails({
  hero,
  item,
  equippedBySlot,
  pending,
  onEquip,
  setProgress,
  setBonusProgress,
  equippedItems,
  onPrevious,
  onNext,
}: {
  hero: Hero
  item: InventoryItem | null
  equippedBySlot: ReadonlyMap<EquipmentSlotKey, InventoryItem>
  pending: boolean
  onEquip: (itemId: string, slot: EquipmentSlotKey) => void
  setProgress: { owned: number; equipped: number } | null
  setBonusProgress: Inventory['setBonusProgress']
  equippedItems: Inventory['equipped']
  onPrevious: () => void
  onNext: () => void
}) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotKey | null>(
    item?.compatibleSlots.find((slot) => !equippedBySlot.has(slot)) ??
      item?.compatibleSlots[0] ??
      null,
  )

  if (!item)
    return (
      <div className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">
        У сховищі поки немає предметів.
      </div>
    )

  const targetSlot = selectedSlot ?? item.compatibleSlots[0]
  const current = targetSlot ? equippedBySlot.get(targetSlot) : undefined
  const setChange = targetSlot
    ? equipmentSetChange(item, current, equippedItems, setBonusProgress)
    : null
  const comparison = [
    ['Шкода', item.damage, current?.damage ?? 0],
    ['Броня', item.armor, current?.armor ?? 0],
    ['Здоров’я', item.health, current?.health ?? 0],
  ] as const

  return (
    <div className="sticky top-4">
      <div className="grid aspect-[4/3] place-items-center border border-ember/35 bg-[radial-gradient(circle,oklch(0.5_0.1_45/18%),transparent_62%)]">
        {item.armor > item.damage ? (
          <Shield className="size-14 text-ember" aria-hidden="true" />
        ) : (
          <Sword className="size-14 text-ember" aria-hidden="true" />
        )}
      </div>
      <p className="mt-4 font-mono text-[0.58rem] uppercase tracking-wider text-ember">
        {itemRarityName(item.rarity)} · {item.itemLevel} рівень
        {item.temperingStage > 0 ? ` · гарт +${item.temperingStage}` : ''}
      </p>
      <h2 className="mt-1 font-serif text-xl">{item.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{item.setName}</p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          className="h-7 flex-1 rounded-sm text-[0.62rem]"
        >
          ← Попередній
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onNext}
          className="h-7 flex-1 rounded-sm text-[0.62rem]"
        >
          Наступний →
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px bg-border/60 text-[0.62rem]">
        <div className="bg-background/70 p-2">
          <dt className="text-muted-foreground">Прив’язка</dt>
          <dd className="mt-1">{itemBindingName(item.binding)}</dd>
        </div>
        <div className="bg-background/70 p-2">
          <dt className="text-muted-foreground">Сила</dt>
          <dd className="mt-1 font-mono">{inventoryItemPower(item)}</dd>
        </div>
        <div className="bg-background/70 p-2">
          <dt className="text-muted-foreground">Гарт</dt>
          <dd className="mt-1 font-mono text-ember">+{item.temperingStage}</dd>
        </div>
        <div className="bg-background/70 p-2">
          <dt className="text-muted-foreground">Гарантія</dt>
          <dd className="mt-1 font-mono">
            {(item.temperingProgress / 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
      {setProgress ? (
        <div className="mt-3 border border-border/60 bg-background/45 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Комплект</span>
            <span>{item.setName}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-muted-foreground">У сховищі</span>
            <span className="font-mono">{setProgress.owned}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span className="text-muted-foreground">Екіпіровано</span>
            <span className="font-mono text-moss">{setProgress.equipped}</span>
          </div>
          {setBonusProgress.some((bonus) => bonus.setId === item.setId) ? (
            <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
              {setBonusProgress
                .filter((bonus) => bonus.setId === item.setId)
                .map((bonus) => (
                  <div
                    key={bonus.requiredPieces}
                    className={`flex items-start justify-between gap-3 text-[0.68rem] ${bonus.active ? 'text-moss' : 'text-muted-foreground'}`}
                  >
                    <span>
                      {bonus.requiredPieces} реч. · {bonus.name}
                    </span>
                    <span className="shrink-0 font-mono">
                      {setBonusStatsText(bonus)}
                    </span>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {setChange ? (
        <div
          className={`mt-3 border px-3 py-2 text-xs ${setChange.kind === 'GAIN' ? 'border-moss/40 bg-moss/5' : setChange.kind === 'LOSS' ? 'border-destructive/40 bg-destructive/5' : 'border-border/60 bg-background/45'}`}
        >
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">
            Вплив на комплект
          </p>
          <p className="mt-1 leading-5">{setChange.message}</p>
        </div>
      ) : null}
      {item.compatibleSlots.length > 1 ? (
        <label className="mt-3 block text-xs text-muted-foreground">
          Слот екіпірування
          <select
            value={targetSlot ?? ''}
            onChange={(event) =>
              setSelectedSlot(event.target.value as EquipmentSlotKey)
            }
            className="mt-1 h-9 w-full border border-border/70 bg-background px-2 text-foreground outline-none"
          >
            {item.compatibleSlots.map((slot) => (
              <option key={slot} value={slot}>
                {EQUIPMENT_SLOT_NAMES[slot]}
                {equippedBySlot.has(slot) ? ' · замінити' : ' · вільно'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <dl className="mt-4 divide-y divide-border/60 border-y border-border/60 text-xs">
        {[
          ['Шкода', item.damage],
          ['Броня', item.armor],
          ['Здоров’я', item.health],
          ['Якість', `${Math.round((item.rollQuality / 9_999) * 100)}%`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      {current ? (
        <div className="mt-3 border border-border/60 bg-background/45 p-3">
          <p className="text-xs text-muted-foreground">
            Порівняння з:{' '}
            <span className="text-foreground">{current.name}</span>
          </p>
          <dl className="mt-2 space-y-1 text-xs">
            {comparison.map(([label, nextValue, currentValue]) => {
              const delta = nextValue - currentValue
              return (
                <div
                  key={label}
                  className="grid grid-cols-[1fr_auto_auto] gap-3"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono">
                    {currentValue} → {nextValue}
                  </dd>
                  <dd
                    className={`min-w-10 text-right font-mono ${deltaColor(delta)}`}
                  >
                    {formatDelta(delta)}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      ) : null}
      {item.compatibleSlots.length > 1 ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="font-mono text-[0.55rem] uppercase text-muted-foreground">
            Порівняння сумісних слотів
          </p>
          <div className="mt-2 space-y-1">
            {item.compatibleSlots.map((slot) => {
              const equipped = equippedBySlot.get(slot)
              const delta =
                inventoryItemPower(item) -
                (equipped ? inventoryItemPower(equipped) : 0)
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`grid w-full grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left text-xs ${targetSlot === slot ? 'border-ember/60 bg-ember/5' : 'border-border/50'}`}
                >
                  <span>
                    {EQUIPMENT_SLOT_NAMES[slot]} · {equipped?.name ?? 'вільно'}
                  </span>
                  <span className={`font-mono ${deltaColor(delta)}`}>
                    {formatDelta(delta)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
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
        className="mt-4 h-9 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
      >
        {pending
          ? 'Екіпіруємо…'
          : targetSlot
            ? `Екіпірувати: ${EQUIPMENT_SLOT_NAMES[targetSlot]}`
            : 'Несумісний предмет'}
      </Button>
    </div>
  )
}

function ProfileSummary({
  hero,
  inventory,
  talents,
  clan,
  weapon,
  averageQuality,
  setProgress,
  onOpenInventory,
}: {
  hero: Hero
  inventory: Inventory
  talents: TalentTree | null
  clan: Clan | null
  weapon: InventoryItem | undefined
  averageQuality: number
  setProgress: Array<[string, number]>
  onOpenInventory: () => void
}) {
  const developedTalents =
    talents?.talents.filter((talent) => talent.rank > 0) ?? []
  const rarityBreakdown = inventory.equipped.reduce((rarities, entry) => {
    rarities.set(entry.item.rarity, (rarities.get(entry.item.rarity) ?? 0) + 1)
    return rarities
  }, new Map<string, number>())
  const emptySlots = Math.max(0, 14 - inventory.equipped.length)
  const maximumAttribute = Math.max(
    inventory.totalDamage,
    inventory.totalArmor,
    inventory.totalHealth,
    1,
  )

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

      <section className="mt-5 border-t border-border/70 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ember">
            Спорядження
          </p>
          <span className="font-mono text-[0.62rem] text-muted-foreground">
            {inventory.equipped.length}/14
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden bg-border/70">
          <div
            className="h-full bg-ember"
            style={{ width: `${(inventory.equipped.length / 14) * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px bg-border/60">
          <ProfileMiniMetric
            label="Середня якість"
            value={`${averageQuality}%`}
          />
          <ProfileMiniMetric label="Порожні слоти" value={emptySlots} />
        </div>
        {rarityBreakdown.size ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from(rarityBreakdown.entries())
              .sort(
                (left, right) =>
                  (INVENTORY_RARITY_ORDER[right[0]] ?? -1) -
                  (INVENTORY_RARITY_ORDER[left[0]] ?? -1),
              )
              .map(([rarity, count]) => (
                <span
                  key={rarity}
                  className="border border-border/70 bg-background/40 px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground"
                >
                  {itemRarityName(rarity)} · {count}
                </span>
              ))}
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onOpenInventory}
          className="mt-3 h-9 w-full rounded-sm"
        >
          <Package aria-hidden="true" /> Відкрити інвентар
        </Button>
      </section>

      <section className="mt-5 border-t border-border/70 pt-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
          Розподіл сили
        </p>
        <div className="mt-3 space-y-3">
          <AttributeBar
            label="Здоров’я"
            value={inventory.totalHealth}
            maximum={maximumAttribute}
          />
          <AttributeBar
            label="Атака"
            value={inventory.totalDamage}
            maximum={maximumAttribute}
          />
          <AttributeBar
            label="Захист"
            value={inventory.totalArmor}
            maximum={maximumAttribute}
          />
        </div>
      </section>

      <section className="mt-5 border-t border-border/70 pt-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ember">
          Комплекти
        </p>
        {setProgress.length ? (
          <div className="mt-3 space-y-2">
            {setProgress.slice(0, 3).map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 border border-border/70 bg-background/35 px-3 py-2"
              >
                <span className="truncate text-xs">{name}</span>
                <span className="font-mono text-xs text-ember">
                  {count} реч.
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Частини комплектів ще не екіпіровані.
          </p>
        )}
        {inventory.activeSetBonuses.length ? (
          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            {inventory.activeSetBonuses.map((bonus) => (
              <div
                key={`${bonus.setId}-${bonus.requiredPieces}`}
                className="border border-moss/40 bg-moss/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-medium text-moss">
                    {bonus.name}
                  </p>
                  <span className="font-mono text-[0.6rem] text-muted-foreground">
                    {bonus.requiredPieces} реч.
                  </span>
                </div>
                <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">
                  {setBonusStatsText(bonus)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[0.68rem] leading-5 text-muted-foreground">
            Перший бонус комплекту відкривається після виконання його
            мінімальної умови.
          </p>
        )}
      </section>

      <section className="mt-5 border-t border-border/70 pt-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-moss">
          Розвинені таланти
        </p>
        {developedTalents.length ? (
          <div className="mt-3 space-y-2">
            {developedTalents.slice(0, 4).map((talent) => (
              <div
                key={talent.type}
                className="border border-border/70 bg-background/35 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-medium">{talent.name}</p>
                  <span className="font-mono text-[0.62rem] text-moss">
                    {talent.rank}/{talent.maxRank}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.68rem] leading-4 text-muted-foreground">
                  {talent.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Вкладіть перші очки, щоб відкрити постійні ефекти героя.
          </p>
        )}
      </section>

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

function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="min-w-0 border-b border-border/60 px-4 py-3 sm:border-r xl:border-b-0 last:border-r-0">
      <dt className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-lg text-foreground">
        {value}
      </dd>
      <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function ProfileMiniMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-background/60 px-3 py-2.5">
      <dt className="font-mono text-[0.52rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}

function AttributeBar({
  label,
  value,
  maximum,
}: {
  label: string
  value: number
  maximum: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden bg-border/70">
        <div
          className="h-full bg-moss"
          style={{ width: `${Math.max(3, (value / maximum) * 100)}%` }}
        />
      </div>
    </div>
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
      query: `mutation Equip($input: EquipItemInput!) { equipItem(input: $input) { ${inventoryFields} } }`,
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

async function executeUnequipMutation(
  slot: EquipmentSlotKey,
  expectedCharacterVersion: number,
): Promise<Inventory> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `mutation Unequip($input: UnequipItemInput!) { unequipItem(input: $input) { ${inventoryFields} } }`,
      variables: {
        input: {
          slot,
          expectedCharacterVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  })
  const payload = (await response.json()) as {
    data?: { unequipItem: Inventory }
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('UNEQUIP_FAILED')
  return payload.data.unequipItem
}

async function loadJourney(): Promise<{
  hero: Hero | null
  world: WorldState | null
  worldMap: WorldMap | null
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
        query: `{ viewer { id } myCharacter { name archetype level experience experienceIntoLevel experienceForNextLevel gold baseStats { health damage armor } } currentLocation { ${worldStateFields} } worldMap { nodes { id name kind status stages note } } myInventory { ${inventoryFields} } myTalents { characterVersion availablePoints resources { type amount } talents { type name description rank maxRank requiredLevel effectPerRank advanced unlocked costResource costAmount affordable } } myClan { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } developments { branch name description rank maxRank requiredClanLevel costResource costAmount affordable unlocked } members { characterId name level role joinedAt contribution } } currentClanBoss { id name tier status maxHealth currentHealth version canSummon nextTier nextMaxHealth summonLockedReason viewerEligibleForReward viewerRewardClaimed viewerCanAttack viewerCurrentHealth viewerMaxHealth rewardType rewardAmount participants { characterId name damage actions maxHealth currentHealth defeated } } }`,
      }),
    })
    const payload = (await response.json()) as {
      data?: {
        viewer?: unknown
        myCharacter?: Hero
        currentLocation?: WorldState
        worldMap?: WorldMap
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
        worldMap: null,
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
        worldMap: null,
        inventory: null,
        talents: null,
        clan: null,
        clanBoss: null,
        redirect: '/character/create',
      }
    return {
      hero: payload.data.myCharacter,
      world: payload.data.currentLocation ?? null,
      worldMap: payload.data.worldMap ?? null,
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
      worldMap: null,
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

async function executeBossInvocation(
  boss:
    | 'CURSED_KNIGHT'
    | 'FALLEN_ELF'
    | 'DARK_PRIEST'
    | 'VEIL_WARDEN_EYES'
    | 'VEIL_WARDEN_ASH',
): Promise<void> {
  const field = {
    CURSED_KNIGHT: 'invokeCursedKnight',
    FALLEN_ELF: 'invokeFallenElf',
    DARK_PRIEST: 'invokeDarkPriest',
    VEIL_WARDEN_EYES: 'invokeVeilWardenFromEyes',
    VEIL_WARDEN_ASH: 'invokeVeilWardenFromAsh',
  }[boss]
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `mutation Invoke($input: InvokeBossInput!) { ${field}(input: $input) { id } }`,
      variables: { input: { idempotencyKey: crypto.randomUUID() } },
    }),
  })
  const payload = (await response.json()) as {
    data?: Record<string, { id: string }>
    errors?: unknown
  }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('BOSS_INVOCATION_FAILED')
}

async function invokeBoss(
  setPending: (pending: boolean) => void,
  setError: (error: string | null) => void,
  boss: 'DARK_PRIEST' | 'VEIL_WARDEN_EYES' | 'VEIL_WARDEN_ASH',
): Promise<void> {
  setPending(true)
  setError(null)
  try {
    await executeBossInvocation(boss)
    window.location.reload()
  } catch {
    setError(
      'Ритуал не розпочався. Перевірте рівень героя, потрібні компоненти та відсутність активного бою.',
    )
    setPending(false)
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
    WEAPON_FRAGMENT: 'уламок зброї',
    HEALTH_POTION: 'зілля відновлення',
    MANA_POTION: 'зілля мани',
    HERBS: 'лікувальні трави',
    OBSIDIAN_SHARD: 'уламок обсидіану',
    VEIL_STEEL: 'сталь Завіси',
    STABILIZED_CATALYST: 'стабілізований каталізатор',
    VEIL_ECHO: 'відгомін Завіси',
    CURSED_HEART: 'серце Проклятого лицаря',
    FALLEN_ELF_EYE: 'око Павшого ельфа',
    DARK_PRIEST_ASH: 'попіл Темного жерця',
    BOSS_INVOCATION_SEAL: 'печатка виклику Проклятого лицаря',
    DARK_PRIEST_INVOCATION_SEAL: 'печатка Темного жерця',
    DRYAD_HEARTWOOD: 'серцевина прадавнього кореня',
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

function setBonusStatsText(bonus: {
  damage: number
  armor: number
  health: number
}): string {
  return [
    bonus.damage > 0 ? `+${bonus.damage} DMG` : null,
    bonus.armor > 0 ? `+${bonus.armor} захист` : null,
    bonus.health > 0 ? `+${bonus.health} HP` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function equipmentSetChange(
  nextItem: InventoryItem,
  currentItem: InventoryItem | undefined,
  equippedItems: Inventory['equipped'],
  progress: Inventory['setBonusProgress'],
): { kind: 'GAIN' | 'LOSS' | 'NEUTRAL'; message: string } | null {
  if (currentItem?.setId === nextItem.setId) {
    return {
      kind: 'NEUTRAL',
      message: `Кількість частин комплекту «${nextItem.setName}» не зміниться.`,
    }
  }

  const currentCounts = new Map<string, number>()
  for (const entry of equippedItems) {
    currentCounts.set(
      entry.item.setId,
      (currentCounts.get(entry.item.setId) ?? 0) + 1,
    )
  }
  const nextSetCount = (currentCounts.get(nextItem.setId) ?? 0) + 1
  const gained = progress.find(
    (bonus) =>
      bonus.setId === nextItem.setId &&
      bonus.requiredPieces === nextSetCount &&
      !bonus.active,
  )

  let lost: Inventory['setBonusProgress'][number] | undefined
  if (currentItem) {
    const currentSetCount = currentCounts.get(currentItem.setId) ?? 0
    lost = progress.find(
      (bonus) =>
        bonus.setId === currentItem.setId &&
        bonus.requiredPieces === currentSetCount &&
        bonus.active,
    )
  }

  if (gained && lost)
    return {
      kind: 'NEUTRAL',
      message: `Активується «${gained.name}» (${setBonusStatsText(gained)}), але буде втрачено «${lost.name}» (${setBonusStatsText(lost)}).`,
    }
  if (gained)
    return {
      kind: 'GAIN',
      message: `Активується «${gained.name}»: ${setBonusStatsText(gained)}.`,
    }
  if (lost)
    return {
      kind: 'LOSS',
      message: `Буде втрачено «${lost.name}»: ${setBonusStatsText(lost)}.`,
    }
  return {
    kind: 'NEUTRAL',
    message: `Після заміни комплект «${nextItem.setName}» матиме ${nextSetCount} част. Активні пороги не зміняться.`,
  }
}

function inventoryItemCategory(item: InventoryItem): InventoryCategory {
  if (
    item.compatibleSlots.some(
      (slot) => slot === 'MAIN_HAND' || slot === 'OFF_HAND',
    )
  )
    return 'WEAPON'
  if (
    item.compatibleSlots.some((slot) =>
      ['AMULET', 'BRACELET', 'RING_LEFT', 'RING_RIGHT'].includes(slot),
    )
  )
    return 'ACCESSORY'
  return 'ARMOR'
}

function inventoryItemPower(item: InventoryItem): number {
  return item.damage + item.armor + item.health
}

function itemBindingName(value: string): string {
  return (
    {
      UNBOUND: 'Не прив’язаний',
      BIND_ON_EQUIP: 'Прив’яжеться при екіпіруванні',
      BOUND: 'Прив’язаний до героя',
      ACCOUNT_BOUND: 'Прив’язаний до облікового запису',
    }[value] ?? value
  )
}

function compareInventoryItems(
  left: InventoryItem,
  right: InventoryItem,
  sort: InventorySort,
): number {
  if (sort === 'NAME') return left.name.localeCompare(right.name, 'uk')
  if (sort === 'LEVEL') return right.itemLevel - left.itemLevel
  if (sort === 'RARITY')
    return (
      (INVENTORY_RARITY_ORDER[right.rarity] ?? -1) -
      (INVENTORY_RARITY_ORDER[left.rarity] ?? -1)
    )
  return inventoryItemPower(right) - inventoryItemPower(left)
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

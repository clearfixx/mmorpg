export type CombatArchetype = 'VANGUARD' | 'RANGER' | 'ARCANIST'
export type Preparation = 'SEARCH_ARMORY' | 'INSPECT_TRACKS' | 'REST_BRAZIER'
export type BattleStatus = 'ACTIVE' | 'WON' | 'LOST' | 'RETREATED'
export type ActionId =
  | 'STRIKE'
  | 'GUARD'
  | 'SHIELD_BASH'
  | 'SECOND_WIND'
  | 'QUICK_SHOT'
  | 'EVADE'
  | 'BARBED_ARROW'
  | 'FOCUSED_SHOT'
  | 'ARCANE_BOLT'
  | 'WARD'
  | 'DISRUPTING_SPARK'
  | 'VEIL_FLARE'
  | 'HEAVY_STRIKE'
  | 'FOCUS_CHANNEL'
  | 'BERSERK'
  | 'MENDING_LIGHT'
  | 'HEALTH_POTION'
  | 'MANA_POTION'

export type CombatActionKind = 'BASIC' | 'EQUIPMENT' | 'SPELL' | 'POTION'
export type CombatActionResource = 'NONE' | 'MANA' | 'ITEM'
export type OffHandMode = 'SHIELD' | 'WEAPON' | 'FOCUS' | 'EMPTY'

export interface CombatAction {
  id: ActionId
  name: string
  cost: number
  description: string
  kind: CombatActionKind
  resource: CombatActionResource
  charges?: number
}

export interface CombatLoadout {
  offHandMode: OffHandMode
  healthPotions: number
  manaPotions: number
}

export type CombatLogKind =
  | 'SYSTEM'
  | 'PLAYER_DAMAGE'
  | 'ENEMY_DAMAGE'
  | 'HEAL'
  | 'DEFENSE'
  | 'STATUS'
  | 'VICTORY'

export interface CombatLogEntry {
  turn: number
  kind: CombatLogKind
  message: string
  amount?: number
  detail?: string
}

export interface BattleState {
  version: number
  turn: number
  status: BattleStatus
  archetype: CombatArchetype
  preparation: Preparation
  weaponDamageBonus: number
  levelDamageBonus: number
  levelArmorBonus: number
  talentDamageBonus: number
  talentArmorBonus: number
  encounterTier: number
  personalBest?: boolean
  rareEncounter?: boolean
  summonedBoss?: boolean
  summonedBossId?: 'CURSED_KNIGHT' | 'FALLEN_ELF'
  returnLocation?: 'BROKEN_WATCHPOST' | 'CINDERHAVEN_GATE'
  region?: 'HOLLOW_ROAD' | 'DRYAD_FOREST'
  enemyLabel: string
  enemyDamageBonus: number
  hero: {
    health: number
    maxHealth: number
    resource: number
    maxResource: number
  }
  enemy: { health: number; maxHealth: number }
  enemies?: BattleEnemy[]
  targetEnemyId?: string
  offHandMode: OffHandMode
  healthPotionCharges: number
  manaPotionCharges: number
  berserkTurns: number
  intentIndex: number
  guardedReduction: number
  bleedingTurns: number
  stunned: boolean
  exposed: boolean
  regeneratingTurns: number
  log: CombatLogEntry[]
}

export interface BattleEnemy {
  id: string
  name: string
  health: number
  maxHealth: number
  damageBonus: number
}

export const INTENTS = [
  {
    id: 'MEASURED_STRIKE',
    name: 'Вивірений удар',
    description: 'Звичайна атака.',
    damage: 18,
  },
  {
    id: 'GATHERING_FORCE',
    name: 'Накопичення сили',
    description: 'Ворог готує нищівний удар.',
    damage: 0,
  },
  {
    id: 'CRUSHING_BLOW',
    name: 'Нищівний удар',
    description: 'Важка атака. Захистіться або перервіть її.',
    damage: 55,
  },
  {
    id: 'OFF_BALANCE',
    name: 'Втрата рівноваги',
    description: 'Захист ворога ослаблений.',
    damage: 0,
  },
] as const

type BaseCombatAction = Pick<
  CombatAction,
  'id' | 'name' | 'cost' | 'description'
>

const ACTIONS: Record<CombatArchetype, BaseCombatAction[]> = {
  VANGUARD: [
    { id: 'STRIKE', name: 'Удар', cost: 0, description: 'Нанести 18 шкоди.' },
    {
      id: 'GUARD',
      name: 'Захист',
      cost: 0,
      description: 'Зменшити наступну шкоду на 70%.',
    },
    {
      id: 'SHIELD_BASH',
      name: 'Удар щитом',
      cost: 2,
      description: '10 шкоди та переривання.',
    },
    {
      id: 'SECOND_WIND',
      name: 'Друге дихання',
      cost: 3,
      description: 'Відновити 28 здоров’я.',
    },
  ],
  RANGER: [
    {
      id: 'QUICK_SHOT',
      name: 'Швидкий постріл',
      cost: 0,
      description: 'Нанести 19 шкоди.',
    },
    {
      id: 'EVADE',
      name: 'Ухилення',
      cost: 0,
      description: 'Повністю уникнути наступної атаки.',
    },
    {
      id: 'BARBED_ARROW',
      name: 'Зазубрена стріла',
      cost: 2,
      description: '12 шкоди та кровотеча.',
    },
    {
      id: 'FOCUSED_SHOT',
      name: 'Прицільний постріл',
      cost: 3,
      description: 'Нанести 31 шкоди.',
    },
  ],
  ARCANIST: [
    {
      id: 'ARCANE_BOLT',
      name: 'Арканний заряд',
      cost: 0,
      description: 'Нанести 21 шкоди.',
    },
    {
      id: 'WARD',
      name: 'Оберіг',
      cost: 0,
      description: 'Зменшити наступну шкоду на 70%.',
    },
    {
      id: 'DISRUPTING_SPARK',
      name: 'Іскра розриву',
      cost: 2,
      description: '12 шкоди та переривання.',
    },
    {
      id: 'VEIL_FLARE',
      name: 'Спалах Завіси',
      cost: 3,
      description: '26 шкоди та викриття.',
    },
  ],
}

export function actionsFor(
  archetype: CombatArchetype,
  loadout: Partial<CombatLoadout> = {},
): CombatAction[] {
  const legacy = ACTIONS[archetype]
  const offHandMode = loadout.offHandMode ?? defaultOffHandMode(archetype)
  const equipment =
    offHandMode === 'SHIELD'
      ? asAction(ACTIONS.VANGUARD[2]!, 'EQUIPMENT', 'MANA')
      : offHandMode === 'FOCUS'
        ? action(
            'FOCUS_CHANNEL',
            'Імпульс фокуса',
            2,
            '18 шкоди та викриття цілі.',
            'EQUIPMENT',
            'MANA',
          )
        : offHandMode === 'WEAPON'
          ? action(
              'HEAVY_STRIKE',
              'Нищівний удар',
              2,
              'Удар двома знаряддями: 28 шкоди.',
              'EQUIPMENT',
              'MANA',
            )
          : null
  return [
    asAction(legacy[0]!, 'BASIC', 'NONE'),
    asAction(legacy[1]!, 'BASIC', 'NONE'),
    ...(equipment ? [equipment] : []),
    action(
      'BERSERK',
      'Берсерк',
      2,
      'Наступні три атаки завдають +10 шкоди.',
      'SPELL',
      'MANA',
    ),
    action(
      'MENDING_LIGHT',
      'Світло зцілення',
      3,
      'Відновити 32 здоров’я.',
      'SPELL',
      'MANA',
    ),
    {
      ...action(
        'HEALTH_POTION',
        'Зілля відновлення',
        0,
        'Відновити 50 здоров’я.',
        'POTION',
        'ITEM',
      ),
      charges: loadout.healthPotions ?? 0,
    },
    {
      ...action(
        'MANA_POTION',
        'Зілля мани',
        0,
        'Відновити 3 мани.',
        'POTION',
        'ITEM',
      ),
      charges: loadout.manaPotions ?? 0,
    },
  ]
}

function action(
  id: ActionId,
  name: string,
  cost: number,
  description: string,
  kind: CombatActionKind,
  resource: CombatActionResource,
): CombatAction {
  return { id, name, cost, description, kind, resource }
}

function asAction(
  value: (typeof ACTIONS)[CombatArchetype][number],
  kind: CombatActionKind,
  resource: CombatActionResource,
): CombatAction {
  return { ...value, kind, resource }
}

function defaultOffHandMode(archetype: CombatArchetype): OffHandMode {
  if (archetype === 'VANGUARD') return 'SHIELD'
  if (archetype === 'RANGER') return 'WEAPON'
  return 'FOCUS'
}

const ARMOR_EFFECTIVENESS = 100

export function mitigateEnemyDamage(
  rawDamage: number,
  armor: number,
  guardedReduction = 0,
): { received: number; blocked: number } {
  const raw = Math.max(0, Math.floor(rawDamage))
  if (raw === 0) return { received: 0, blocked: 0 }
  if (guardedReduction >= 1) return { received: 0, blocked: raw }

  const effectiveArmor = Math.max(0, Math.floor(armor))
  const afterArmor = Math.ceil(
    raw * (ARMOR_EFFECTIVENESS / (ARMOR_EFFECTIVENESS + effectiveArmor)),
  )
  const received = Math.max(
    1,
    Math.floor(afterArmor * (1 - Math.max(0, guardedReduction))),
  )
  return { received, blocked: raw - received }
}

export function createBattle(
  archetype: CombatArchetype,
  preparation: Preparation,
  weaponDamageBonus = 0,
  encounterTier = 1,
  heroLevel = 1,
  talents = { health: 0, damage: 0, armor: 0 },
  rareEncounter = false,
  loadout: Partial<CombatLoadout> = {},
): BattleState {
  const levelRanks = Math.max(0, Math.floor(heroLevel) - 1)
  const maxHealth =
    { VANGUARD: 140, RANGER: 100, ARCANIST: 90 }[archetype] +
    levelRanks * 8 +
    talents.health
  const ordinaryEnemyHealth = 125 + (encounterTier - 1) * 40
  const enemyMaxHealth = rareEncounter
    ? Math.max(Math.ceil(ordinaryEnemyHealth * 2.2), 600 + heroLevel * 15)
    : ordinaryEnemyHealth
  const enemyLabel = rareEncounter
    ? 'Вартовий Забутого Закляття'
    : encounterTier > 1
      ? 'Загартований Завісою розоритель'
      : 'Спотворений Завісою мародер'
  return {
    version: 1,
    turn: 1,
    status: 'ACTIVE',
    archetype,
    preparation,
    weaponDamageBonus,
    levelDamageBonus: levelRanks * 2,
    levelArmorBonus: levelRanks,
    talentDamageBonus: talents.damage,
    talentArmorBonus: talents.armor,
    encounterTier,
    rareEncounter,
    enemyLabel,
    enemyDamageBonus:
      (encounterTier - 1) * 6 + (rareEncounter ? 18 + heroLevel : 0),
    hero: { health: maxHealth, maxHealth, resource: 3, maxResource: 5 },
    enemy: { health: enemyMaxHealth, maxHealth: enemyMaxHealth },
    offHandMode: loadout.offHandMode ?? defaultOffHandMode(archetype),
    healthPotionCharges: Math.max(0, Math.floor(loadout.healthPotions ?? 0)),
    manaPotionCharges: Math.max(0, Math.floor(loadout.manaPotions ?? 0)),
    berserkTurns: 0,
    intentIndex: 0,
    guardedReduction: 0,
    bleedingTurns: 0,
    stunned: false,
    exposed: false,
    regeneratingTurns: preparation === 'REST_BRAZIER' ? 3 : 0,
    log: [
      {
        turn: 0,
        kind: 'SYSTEM',
        message: rareEncounter
          ? `${enemyLabel} перегороджує шлях. На його обладунках палає печатка виклику.`
          : `${enemyLabel} виходить на дорогу.`,
      },
    ],
  }
}

export function createDryadForestBattle(
  archetype: CombatArchetype,
  weaponDamageBonus = 0,
  encounterTier = 1,
  heroLevel = 1,
  talents = { health: 0, damage: 0, armor: 0 },
  loadout: Partial<CombatLoadout> = {},
): BattleState {
  const state = createBattle(
    archetype,
    'REST_BRAZIER',
    weaponDamageBonus,
    encounterTier,
    heroLevel,
    talents,
    false,
    loadout,
  )
  state.region = 'DRYAD_FOREST'
  state.returnLocation = 'CINDERHAVEN_GATE'
  if (encounterTier < 35) {
    state.enemyLabel =
      encounterTier > 1 ? 'Охоронець коріння' : 'Збожеволіла дріада'
    state.log[0] = {
      turn: 0,
      kind: 'SYSTEM',
      message: `${state.enemyLabel} виходить із живої хащі.`,
    }
    return state
  }

  const baseHealth = 90 + encounterTier * 18
  state.enemyLabel = 'Варта Кореневого форпосту'
  // Group pressure comes from several actions, so each defender uses a lower
  // personal scaling curve than a solo road enemy of the same tier.
  state.enemyDamageBonus = 18 + Math.floor(encounterTier * 1.5)
  state.enemies = [
    enemy('dryad-sentinel', 'Дріада-страж', baseHealth, 4),
    enemy(
      'thorn-archer',
      'Терновий стрілець',
      Math.floor(baseHealth * 0.72),
      0,
    ),
    enemy('root-caller', 'Заклинач коріння', Math.floor(baseHealth * 0.82), 2),
  ]
  state.targetEnemyId = state.enemies[0]!.id
  state.enemy = combatantFor(state.enemies[0]!)
  state.log[0] = {
    turn: 0,
    kind: 'SYSTEM',
    message:
      'Варта Кореневого форпосту оточує героя. Усі живі захисники відповідатимуть на кожен хід.',
  }
  return state
}

export function resolveTurn(
  state: BattleState,
  actionId: ActionId,
  targetEnemyId?: string,
): BattleState {
  if (state.status !== 'ACTIVE') throw new Error('BATTLE_COMPLETE')
  const action = actionsFor(state.archetype, {
    offHandMode: state.offHandMode,
    healthPotions: state.healthPotionCharges ?? 0,
    manaPotions: state.manaPotionCharges ?? 0,
  }).find((candidate) => candidate.id === actionId)
  if (!action) throw new Error('ACTION_UNAVAILABLE')
  if (action.resource === 'MANA' && state.hero.resource < action.cost)
    throw new Error('INSUFFICIENT_RESOURCE')
  if (actionId === 'HEALTH_POTION' && (state.healthPotionCharges ?? 0) < 1)
    throw new Error('POTION_UNAVAILABLE')
  if (actionId === 'MANA_POTION' && (state.manaPotionCharges ?? 0) < 1)
    throw new Error('POTION_UNAVAILABLE')

  const next: BattleState = structuredClone(state)
  next.offHandMode = state.offHandMode ?? defaultOffHandMode(state.archetype)
  next.healthPotionCharges = state.healthPotionCharges ?? 0
  next.manaPotionCharges = state.manaPotionCharges ?? 0
  next.berserkTurns = state.berserkTurns ?? 0
  const enemies = next.enemies
  const target = enemies
    ? (enemies.find(
        (enemy) =>
          enemy.id === (targetEnemyId ?? next.targetEnemyId) &&
          enemy.health > 0,
      ) ?? enemies.find((enemy) => enemy.health > 0))
    : null
  if (enemies && !target) throw new Error('TARGET_UNAVAILABLE')
  if (target) {
    next.targetEnemyId = target.id
    next.enemyLabel = target.name
    next.enemy = combatantFor(target)
  }
  next.log = normalizeLog(next.log)
  if (action.resource === 'MANA') next.hero.resource -= action.cost
  let damage = 0

  switch (actionId) {
    case 'STRIKE':
      damage = 18
      break
    case 'QUICK_SHOT':
      damage = 19
      break
    case 'ARCANE_BOLT':
      damage = 21
      break
    case 'FOCUSED_SHOT':
      damage = 31
      break
    case 'HEAVY_STRIKE':
      damage = 28
      break
    case 'FOCUS_CHANNEL':
      damage = 18
      next.exposed = true
      break
    case 'BARBED_ARROW':
      damage = 12
      next.bleedingTurns = 3
      break
    case 'SHIELD_BASH':
    case 'DISRUPTING_SPARK':
      damage = 12
      next.stunned = true
      break
    case 'VEIL_FLARE':
      damage = 26
      next.exposed = true
      break
    case 'GUARD':
    case 'WARD':
      next.guardedReduction = 0.7
      break
    case 'EVADE':
      next.guardedReduction = 1
      break
    case 'SECOND_WIND': {
      const before = next.hero.health
      next.hero.health = Math.min(next.hero.maxHealth, next.hero.health + 28)
      next.log.push({
        turn: state.turn,
        kind: 'HEAL',
        message: `Герой застосовує «${action.name}».`,
        amount: next.hero.health - before,
      })
      break
    }
    case 'BERSERK':
      next.berserkTurns = 3
      next.log.push({
        turn: state.turn,
        kind: 'STATUS',
        message: 'Герой входить у стан берсерка на три атаки.',
      })
      break
    case 'MENDING_LIGHT':
    case 'HEALTH_POTION': {
      const amount = actionId === 'HEALTH_POTION' ? 50 : 32
      const before = next.hero.health
      next.hero.health = Math.min(
        next.hero.maxHealth,
        next.hero.health + amount,
      )
      if (actionId === 'HEALTH_POTION') next.healthPotionCharges -= 1
      next.log.push({
        turn: state.turn,
        kind: 'HEAL',
        message: `Герой застосовує «${action.name}».`,
        amount: next.hero.health - before,
      })
      break
    }
    case 'MANA_POTION': {
      const before = next.hero.resource
      next.hero.resource = Math.min(
        next.hero.maxResource,
        next.hero.resource + 3,
      )
      next.manaPotionCharges -= 1
      next.log.push({
        turn: state.turn,
        kind: 'STATUS',
        message: `Герой застосовує «${action.name}» і відновлює ${next.hero.resource - before} мани.`,
      })
      break
    }
  }

  if (damage > 0)
    damage += (state.weaponDamageBonus ?? 0) + (state.levelDamageBonus ?? 0)
  if (damage > 0) damage += state.talentDamageBonus ?? 0
  if (damage > 0 && next.berserkTurns > 0) {
    damage += 10
    next.berserkTurns -= 1
  }

  if (state.exposed && damage > 0) damage = Math.ceil(damage * 1.5)
  next.enemy.health = Math.max(0, next.enemy.health - damage)
  if (target) target.health = next.enemy.health
  if (damage > 0)
    next.log.push({
      turn: state.turn,
      kind: 'PLAYER_DAMAGE',
      message: `Герой застосовує «${action.name}».`,
      amount: damage,
    })
  else if (
    ![
      'SECOND_WIND',
      'BERSERK',
      'MENDING_LIGHT',
      'HEALTH_POTION',
      'MANA_POTION',
    ].includes(actionId)
  )
    next.log.push({
      turn: state.turn,
      kind: 'DEFENSE',
      message: `Герой застосовує «${action.name}».`,
      detail: action.description,
    })

  if (next.bleedingTurns > 0) {
    next.enemy.health = Math.max(0, next.enemy.health - 5)
    if (target) target.health = next.enemy.health
    next.bleedingTurns -= 1
    next.log.push({
      turn: state.turn,
      kind: 'STATUS',
      message: `${next.enemyLabel ?? 'Ворог'} стікає кров’ю.`,
      amount: 5,
    })
  }
  const groupDefeated = next.enemies?.every((enemy) => enemy.health === 0)
  if (next.enemy.health === 0 && (!next.enemies || groupDefeated)) {
    next.status = 'WON'
    next.version += 1
    next.log.push({
      turn: state.turn,
      kind: 'VICTORY',
      message: `${next.enemyLabel ?? 'Ворог'} падає. Перемога.`,
    })
    return next
  }
  if (target && target.health === 0 && next.enemies) {
    const nextTarget = next.enemies.find((enemy) => enemy.health > 0)
    if (nextTarget) {
      next.targetEnemyId = nextTarget.id
      next.enemyLabel = nextTarget.name
      next.enemy = combatantFor(nextTarget)
    }
  }

  const intent = INTENTS[state.intentIndex] ?? INTENTS[0]!
  if (next.stunned) {
    next.log.push({
      turn: state.turn,
      kind: 'DEFENSE',
      message: 'Небезпечну атаку ворога перервано.',
    })
    next.stunned = false
  } else if (intent.damage > 0) {
    const armor =
      (state.preparation === 'SEARCH_ARMORY' ? 4 : 0) +
      (state.levelArmorBonus ?? 0) +
      (state.talentArmorBonus ?? 0)
    const attackers = next.enemies?.filter((enemy) => enemy.health > 0) ?? [
      null,
    ]
    for (const attacker of attackers) {
      const raw =
        intent.damage +
        (state.enemyDamageBonus ?? 0) +
        (attacker?.damageBonus ?? 0)
      const { received, blocked } = mitigateEnemyDamage(
        raw,
        armor,
        next.guardedReduction,
      )
      next.hero.health = Math.max(0, next.hero.health - received)
      next.log.push({
        turn: state.turn,
        kind: 'ENEMY_DAMAGE',
        message: `${attacker?.name ?? next.enemyLabel ?? 'Ворог'} застосовує «${intent.name}».`,
        amount: received,
        ...(blocked > 0 ? { detail: `Заблоковано ${blocked} шкоди.` } : {}),
      })
      if (next.hero.health === 0) break
    }
  } else {
    next.log.push({
      turn: state.turn,
      kind: 'SYSTEM',
      message: intent.description,
    })
  }

  if (next.regeneratingTurns > 0 && next.hero.health > 0) {
    next.hero.health = Math.min(next.hero.maxHealth, next.hero.health + 6)
    next.regeneratingTurns -= 1
    next.log.push({
      turn: state.turn,
      kind: 'HEAL',
      message: 'Підготовка відновлює здоров’я.',
      amount: 6,
    })
  }
  next.guardedReduction = 0
  next.exposed = intent.id === 'OFF_BALANCE'
  next.intentIndex = (state.intentIndex + 1) % INTENTS.length
  next.turn += 1
  next.version += 1
  next.hero.resource = Math.min(next.hero.maxResource, next.hero.resource + 1)
  if (next.hero.health === 0) {
    next.status = 'LOST'
    next.log.push({
      turn: state.turn,
      kind: 'ENEMY_DAMAGE',
      message: 'Герой не витримує удару.',
    })
  }
  return next
}

function enemy(
  id: string,
  name: string,
  maxHealth: number,
  damageBonus: number,
): BattleEnemy {
  return { id, name, health: maxHealth, maxHealth, damageBonus }
}

function combatantFor(enemy: BattleEnemy) {
  return { health: enemy.health, maxHealth: enemy.maxHealth }
}

function normalizeLog(log: BattleState['log'] | string[]): CombatLogEntry[] {
  return log.map((entry) =>
    typeof entry === 'string'
      ? { turn: 0, kind: 'SYSTEM' as const, message: entry }
      : entry,
  )
}

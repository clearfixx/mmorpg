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

export interface CombatAction {
  id: ActionId
  name: string
  cost: number
  description: string
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
  returnLocation?: 'BROKEN_WATCHPOST' | 'CINDERHAVEN_GATE'
  enemyLabel: string
  enemyDamageBonus: number
  hero: {
    health: number
    maxHealth: number
    resource: number
    maxResource: number
  }
  enemy: { health: number; maxHealth: number }
  intentIndex: number
  guardedReduction: number
  bleedingTurns: number
  stunned: boolean
  exposed: boolean
  regeneratingTurns: number
  log: CombatLogEntry[]
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

const ACTIONS: Record<CombatArchetype, CombatAction[]> = {
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

export function actionsFor(archetype: CombatArchetype): CombatAction[] {
  return ACTIONS[archetype]
}

export function createBattle(
  archetype: CombatArchetype,
  preparation: Preparation,
  weaponDamageBonus = 0,
  encounterTier = 1,
  heroLevel = 1,
  talents = { health: 0, damage: 0, armor: 0 },
  rareEncounter = false,
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

export function resolveTurn(
  state: BattleState,
  actionId: ActionId,
): BattleState {
  if (state.status !== 'ACTIVE') throw new Error('BATTLE_COMPLETE')
  const action = actionsFor(state.archetype).find(
    (candidate) => candidate.id === actionId,
  )
  if (!action) throw new Error('ACTION_UNAVAILABLE')
  if (state.hero.resource < action.cost)
    throw new Error('INSUFFICIENT_RESOURCE')

  const next: BattleState = structuredClone(state)
  next.log = normalizeLog(next.log)
  next.hero.resource -= action.cost
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
  }

  if (damage > 0)
    damage += (state.weaponDamageBonus ?? 0) + (state.levelDamageBonus ?? 0)
  if (damage > 0) damage += state.talentDamageBonus ?? 0

  if (state.exposed && damage > 0) damage = Math.ceil(damage * 1.5)
  next.enemy.health = Math.max(0, next.enemy.health - damage)
  if (damage > 0)
    next.log.push({
      turn: state.turn,
      kind: 'PLAYER_DAMAGE',
      message: `Герой застосовує «${action.name}».`,
      amount: damage,
    })
  else if (actionId !== 'SECOND_WIND')
    next.log.push({
      turn: state.turn,
      kind: 'DEFENSE',
      message: `Герой застосовує «${action.name}».`,
      detail: action.description,
    })

  if (next.bleedingTurns > 0) {
    next.enemy.health = Math.max(0, next.enemy.health - 5)
    next.bleedingTurns -= 1
    next.log.push({
      turn: state.turn,
      kind: 'STATUS',
      message: `${next.enemyLabel ?? 'Ворог'} стікає кров’ю.`,
      amount: 5,
    })
  }
  if (next.enemy.health === 0) {
    next.status = 'WON'
    next.version += 1
    next.log.push({
      turn: state.turn,
      kind: 'VICTORY',
      message: `${next.enemyLabel ?? 'Ворог'} падає. Перемога.`,
    })
    return next
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
    const armorReduction =
      (state.preparation === 'SEARCH_ARMORY' ? 4 : 0) +
      (state.levelArmorBonus ?? 0) +
      (state.talentArmorBonus ?? 0)
    const raw = Math.max(
      0,
      intent.damage + (state.enemyDamageBonus ?? 0) - armorReduction,
    )
    const received = Math.floor(raw * (1 - next.guardedReduction))
    const blocked = intent.damage - received
    next.hero.health = Math.max(0, next.hero.health - received)
    next.log.push({
      turn: state.turn,
      kind: 'ENEMY_DAMAGE',
      message: `${next.enemyLabel ?? 'Ворог'} застосовує «${intent.name}».`,
      amount: received,
      ...(blocked > 0 ? { detail: `Заблоковано ${blocked} шкоди.` } : {}),
    })
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

function normalizeLog(log: BattleState['log'] | string[]): CombatLogEntry[] {
  return log.map((entry) =>
    typeof entry === 'string'
      ? { turn: 0, kind: 'SYSTEM' as const, message: entry }
      : entry,
  )
}

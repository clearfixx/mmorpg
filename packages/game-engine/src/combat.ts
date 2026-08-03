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

export interface BattleState {
  version: number
  turn: number
  status: BattleStatus
  archetype: CombatArchetype
  preparation: Preparation
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
  log: string[]
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
): BattleState {
  const maxHealth = { VANGUARD: 140, RANGER: 100, ARCANIST: 90 }[archetype]
  return {
    version: 1,
    turn: 1,
    status: 'ACTIVE',
    archetype,
    preparation,
    hero: { health: maxHealth, maxHealth, resource: 3, maxResource: 5 },
    enemy: { health: 125, maxHealth: 125 },
    intentIndex: 0,
    guardedReduction: 0,
    bleedingTurns: 0,
    stunned: false,
    exposed: false,
    regeneratingTurns: preparation === 'REST_BRAZIER' ? 3 : 0,
    log: ['Спотворений Завісою мародер виходить на дорогу.'],
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
  next.log = []
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
    case 'SECOND_WIND':
      next.hero.health = Math.min(next.hero.maxHealth, next.hero.health + 28)
      break
  }

  if (state.exposed && damage > 0) damage = Math.ceil(damage * 1.5)
  next.enemy.health = Math.max(0, next.enemy.health - damage)
  next.log.push(
    `${action.name}: ${damage > 0 ? `${damage} шкоди.` : action.description}`,
  )

  if (next.bleedingTurns > 0) {
    next.enemy.health = Math.max(0, next.enemy.health - 5)
    next.bleedingTurns -= 1
    next.log.push('Кровотеча завдає 5 шкоди.')
  }
  if (next.enemy.health === 0) {
    next.status = 'WON'
    next.version += 1
    next.log.push('Мародер падає. Перемога.')
    return next
  }

  const intent = INTENTS[state.intentIndex] ?? INTENTS[0]!
  if (next.stunned) {
    next.log.push('Атаку ворога перервано.')
    next.stunned = false
  } else if (intent.damage > 0) {
    const armorReduction = state.preparation === 'SEARCH_ARMORY' ? 4 : 0
    const raw = Math.max(0, intent.damage - armorReduction)
    const received = Math.floor(raw * (1 - next.guardedReduction))
    next.hero.health = Math.max(0, next.hero.health - received)
    next.log.push(`${intent.name}: герой отримує ${received} шкоди.`)
  } else {
    next.log.push(intent.description)
  }

  if (next.regeneratingTurns > 0 && next.hero.health > 0) {
    next.hero.health = Math.min(next.hero.maxHealth, next.hero.health + 6)
    next.regeneratingTurns -= 1
    next.log.push('Регенерація відновлює 6 здоров’я.')
  }
  next.guardedReduction = 0
  next.exposed = intent.id === 'OFF_BALANCE'
  next.intentIndex = (state.intentIndex + 1) % INTENTS.length
  next.turn += 1
  next.version += 1
  next.hero.resource = Math.min(next.hero.maxResource, next.hero.resource + 1)
  if (next.hero.health === 0) {
    next.status = 'LOST'
    next.log.push('Герой не витримує удару.')
  }
  return next
}

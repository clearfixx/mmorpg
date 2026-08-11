export const RESOURCE_ORIGINS = [
  'DROPPED',
  'CRAFTED',
  'BOSS_EXCLUSIVE',
] as const

export type ResourceOrigin = (typeof RESOURCE_ORIGINS)[number]

export const RESOURCE_RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
  'MYTHIC',
  'DIVINE',
] as const

export type ResourceRarity = (typeof RESOURCE_RARITIES)[number]

export const RESOURCE_TYPES = [
  'IRON',
  'COPPER',
  'BRONZE',
  'COAL',
  'TIMBER',
  'LEATHER',
  'WEAPON_FRAGMENT',
  'HERBS',
  'OBSIDIAN_SHARD',
  'VEIL_STEEL',
  'STABILIZED_CATALYST',
  'VEIL_ECHO',
  'CURSED_HEART',
  'FALLEN_ELF_EYE',
  'DARK_PRIEST_ASH',
  'BOSS_INVOCATION_SEAL',
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ResourceDefinition {
  type: ResourceType
  name: string
  description: string
  origin: ResourceOrigin
  rarity: ResourceRarity
  tradeable: boolean
  clanContributable: boolean
  clanContributionWeight: number
}

export const RESOURCE_DEFINITIONS: Readonly<
  Record<ResourceType, ResourceDefinition>
> = {
  IRON: dropped('IRON', 'Залізо', 'Поширений метал для базового ремесла.', 1),
  COPPER: dropped(
    'COPPER',
    'Мідь',
    'М’який метал для провідників, сплавів і розвитку.',
    3,
  ),
  BRONZE: dropped(
    'BRONZE',
    'Бронза',
    'Цінний ранній сплав, що також трапляється у старих сховищах.',
    8,
    'UNCOMMON',
  ),
  COAL: dropped('COAL', 'Вугілля', 'Паливо для кузень і випалювання руди.'),
  TIMBER: dropped(
    'TIMBER',
    'Деревина',
    'Основа для древків, луків, споруд і вогнищ.',
  ),
  LEATHER: dropped(
    'LEATHER',
    'Шкіра',
    'Матеріал для легкої броні, ременів і піхов.',
  ),
  WEAPON_FRAGMENT: dropped(
    'WEAPON_FRAGMENT',
    'Уламок зброї',
    'Пошкоджена частина клинка або обладунку, придатна для переплавлення й ранніх рецептів.',
    2,
    'UNCOMMON',
  ),
  HERBS: dropped(
    'HERBS',
    'Лікувальні трави',
    'Сировина для перших настоїв та алхімічних сумішей.',
  ),
  OBSIDIAN_SHARD: dropped(
    'OBSIDIAN_SHARD',
    'Уламок обсидіану',
    'Гострий уламок із небезпечних глибин і високих рівнів пригод.',
    12,
    'RARE',
  ),
  VEIL_STEEL: crafted(
    'VEIL_STEEL',
    'Сталь Завіси',
    'Стабілізований сплав, якого не існує у природному вигляді.',
    'RARE',
  ),
  STABILIZED_CATALYST: crafted(
    'STABILIZED_CATALYST',
    'Стабілізований каталізатор',
    'Складний реагент для багатокомпонентних і ритуальних рецептів.',
    'EPIC',
  ),
  VEIL_ECHO: bossExclusive(
    'VEIL_ECHO',
    'Відгомін Завіси',
    'Залишкова сила переможених кланових і ритуальних створінь.',
    'EPIC',
    25,
  ),
  CURSED_HEART: bossExclusive(
    'CURSED_HEART',
    'Серце Проклятого лицаря',
    'Трофей, що існує лише в тілі викликаного Проклятого лицаря.',
    'MYTHIC',
  ),
  FALLEN_ELF_EYE: bossExclusive(
    'FALLEN_ELF_EYE',
    'Око Павшого ельфа',
    'Міфічний трофей однієї з гілок виклику.',
    'MYTHIC',
  ),
  DARK_PRIEST_ASH: bossExclusive(
    'DARK_PRIEST_ASH',
    'Попіл Темного жерця',
    'Міфічний залишок ритуального супротивника.',
    'MYTHIC',
  ),
  BOSS_INVOCATION_SEAL: bossExclusive(
    'BOSS_INVOCATION_SEAL',
    'Печатка виклику Проклятого лицаря',
    'Переносне закляття, здобуте у рідкісного носія. Відкриває першу ланку ритуального полювання.',
    'LEGENDARY',
  ),
}

export function resourceDefinition(type: ResourceType): ResourceDefinition {
  return RESOURCE_DEFINITIONS[type]
}

function dropped(
  type: ResourceType,
  name: string,
  description: string,
  clanContributionWeight = 1,
  rarity: ResourceRarity = 'COMMON',
): ResourceDefinition {
  return {
    type,
    name,
    description,
    origin: 'DROPPED',
    rarity,
    tradeable: true,
    clanContributable: true,
    clanContributionWeight,
  }
}

function crafted(
  type: ResourceType,
  name: string,
  description: string,
  rarity: ResourceRarity,
): ResourceDefinition {
  return {
    type,
    name,
    description,
    origin: 'CRAFTED',
    rarity,
    tradeable: true,
    clanContributable: false,
    clanContributionWeight: 0,
  }
}

function bossExclusive(
  type: ResourceType,
  name: string,
  description: string,
  rarity: ResourceRarity,
  clanContributionWeight = 0,
): ResourceDefinition {
  return {
    type,
    name,
    description,
    origin: 'BOSS_EXCLUSIVE',
    rarity,
    tradeable: true,
    clanContributable: clanContributionWeight > 0,
    clanContributionWeight,
  }
}

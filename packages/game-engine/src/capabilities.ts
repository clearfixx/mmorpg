export const CHARACTER_ACTIONS = [
  'INVOKE_RITUAL_BOSS',
  'ENTER_DRYAD_FOREST',
  'USE_TEMPERING_FORGE',
] as const

export type CharacterAction = (typeof CHARACTER_ACTIONS)[number]

export interface CharacterCapabilityState {
  level: number
  currentLocation: string | null
  cinderhavenUnlocked?: boolean
}

type CapabilityRule = (state: CharacterCapabilityState) => boolean

const CAPABILITY_RULES: Readonly<Record<CharacterAction, CapabilityRule>> = {
  INVOKE_RITUAL_BOSS: (state) =>
    state.level >= 30 && state.currentLocation === 'CINDERHAVEN_GATE',
  ENTER_DRYAD_FOREST: (state) =>
    state.level >= 20 && state.cinderhavenUnlocked === true,
  USE_TEMPERING_FORGE: (state) =>
    state.level >= 60 && state.currentLocation === 'CINDERHAVEN_GATE',
}

export function canCharacterPerform(
  action: CharacterAction,
  state: CharacterCapabilityState,
): boolean {
  return CAPABILITY_RULES[action](state)
}

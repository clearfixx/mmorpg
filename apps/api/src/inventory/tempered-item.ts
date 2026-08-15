import { temperedStats } from '@veilfall/game-engine';

export function withTemperedStats<
  T extends {
    damage: number;
    armor: number;
    health: number;
    temperingStage: number;
  },
>(item: T): T {
  return { ...item, ...temperedStats(item, item.temperingStage) };
}

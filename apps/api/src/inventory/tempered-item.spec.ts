import { withTemperedStats } from './tempered-item';

describe('withTemperedStats', () => {
  it('applies the item stage without mutating its persisted base roll', () => {
    const item = {
      id: 'item-1',
      damage: 100,
      armor: 50,
      health: 20,
      temperingStage: 15,
    };
    expect(withTemperedStats(item)).toEqual({
      id: 'item-1',
      damage: 235,
      armor: 118,
      health: 47,
      temperingStage: 15,
    });
    expect(item).toMatchObject({ damage: 100, armor: 50, health: 20 });
  });
});

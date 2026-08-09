import { expeditionCheckpointCost } from './combat.service';

describe('expedition checkpoint cost', () => {
  it('grows quadratically with expedition depth', () => {
    expect(expeditionCheckpointCost(2)).toBe(100);
    expect(expeditionCheckpointCost(5)).toBe(625);
    expect(expeditionCheckpointCost(10)).toBe(2_500);
  });

  it('never prices a checkpoint below tier two', () => {
    expect(expeditionCheckpointCost(0)).toBe(100);
  });
});

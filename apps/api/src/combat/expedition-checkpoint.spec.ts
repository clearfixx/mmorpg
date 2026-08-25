import {
  expeditionCheckpointCost,
  rareEncounterWeek,
  shouldSpawnRareEncounter,
} from './combat.service';

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

describe('rare encounter cadence', () => {
  it('starts a weekly cycle on Monday in UTC', () => {
    expect(rareEncounterWeek(new Date('2026-08-12T12:00:00Z'))).toBe(
      '2026-08-10',
    );
  });

  it('guarantees the first level-30 encounter and caps the cycle at five', () => {
    expect(
      shouldSpawnRareEncounter({ level: 29, encounters: 0, roll: 0 }),
    ).toBe(false);
    expect(
      shouldSpawnRareEncounter({ level: 30, encounters: 0, roll: 9_999 }),
    ).toBe(true);
    expect(
      shouldSpawnRareEncounter({ level: 60, encounters: 5, roll: 0 }),
    ).toBe(false);
  });

  it('reduces the chance after every discovered rare NPC', () => {
    expect(
      shouldSpawnRareEncounter({ level: 30, encounters: 1, roll: 2_499 }),
    ).toBe(true);
    expect(
      shouldSpawnRareEncounter({ level: 30, encounters: 1, roll: 2_500 }),
    ).toBe(false);
    expect(
      shouldSpawnRareEncounter({ level: 30, encounters: 4, roll: 299 }),
    ).toBe(true);
    expect(
      shouldSpawnRareEncounter({ level: 30, encounters: 4, roll: 300 }),
    ).toBe(false);
  });

  it('supports an explicit non-production test override', () => {
    expect(
      shouldSpawnRareEncounter({
        level: 30,
        encounters: 99,
        roll: 9_999,
        force: true,
      }),
    ).toBe(true);
  });
});

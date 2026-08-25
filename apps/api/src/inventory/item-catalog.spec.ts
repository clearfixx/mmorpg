import { CharacterArchetype, EquipmentSlot } from '@veilfall/database';

import {
  itemDefinition,
  itemStatsForPower,
  rewardDefinitionFor,
  veilWardenRelicDefinition,
} from './item-catalog';

describe('item catalog', () => {
  it('keeps the first reward as an archetype weapon', () => {
    expect(
      rewardDefinitionFor(CharacterArchetype.VANGUARD, 1).equipmentSlots,
    ).toEqual([EquipmentSlot.MAIN_HAND]);
  });

  it('cycles deeper rewards through armor and accessories', () => {
    expect(
      rewardDefinitionFor(CharacterArchetype.RANGER, 2).equipmentSlots,
    ).toEqual([EquipmentSlot.HEAD]);
    expect(
      rewardDefinitionFor(CharacterArchetype.RANGER, 13).equipmentSlots,
    ).toEqual([EquipmentSlot.RING_LEFT, EquipmentSlot.RING_RIGHT]);
    expect(
      rewardDefinitionFor(CharacterArchetype.RANGER, 14).equipmentSlots,
    ).toEqual([EquipmentSlot.HEAD]);
  });

  it('builds defensive stats without phantom damage', () => {
    const helmet = itemDefinition('veteran-helm-v1');
    expect(helmet).not.toBeNull();
    expect(itemStatsForPower(100, helmet!.statWeights)).toEqual({
      damage: 0,
      armor: 55,
      health: 180,
    });
  });

  it('registers the Veil Warden reward as a real equippable relic', () => {
    const relic = veilWardenRelicDefinition();
    expect(itemDefinition(relic.definitionId)).toEqual(relic);
    expect(relic).toMatchObject({
      definitionId: 'veil-warden-heart-v1',
      equipmentSlots: [EquipmentSlot.AMULET],
      setId: 'veil-warden',
    });
  });
});

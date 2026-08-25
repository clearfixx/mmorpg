import { EquipmentSlot } from '@veilfall/database';

import {
  equipmentSlotsForDefinition,
  isEquipmentSlotCompatible,
} from './inventory.service';

describe('equipment slot compatibility', () => {
  it('allows the starter weapons only in the main hand', () => {
    expect(
      isEquipmentSlotCompatible(
        'veteran-notched-blade-v1',
        EquipmentSlot.MAIN_HAND,
      ),
    ).toBe(true);
    expect(
      isEquipmentSlotCompatible(
        'veteran-notched-blade-v1',
        EquipmentSlot.OFF_HAND,
      ),
    ).toBe(false);
  });

  it('rejects unknown definitions in every slot', () => {
    expect(
      isEquipmentSlotCompatible('unknown-item', EquipmentSlot.RING_LEFT),
    ).toBe(false);
    expect(equipmentSlotsForDefinition('unknown-item')).toEqual([]);
  });

  it('exposes compatible slots to clients', () => {
    expect(equipmentSlotsForDefinition('veteran-ashwood-bow-v1')).toEqual([
      EquipmentSlot.MAIN_HAND,
    ]);
  });
});

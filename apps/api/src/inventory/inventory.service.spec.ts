import { EquipmentSlot } from '@veilfall/database';

import { isEquipmentSlotCompatible } from './inventory.service';

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
  });
});

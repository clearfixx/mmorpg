import { canItemPerformInventoryAction } from './tempering-item-capability';

describe('tempering item capability', () => {
  it('allows mutable inventory actions only without an active process', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'active-process' });
    const database = { temperingJob: { findUnique } } as never;

    await expect(
      canItemPerformInventoryAction(database, 'free-item'),
    ).resolves.toBe(true);
    await expect(
      canItemPerformInventoryAction(database, 'locked-item'),
    ).resolves.toBe(false);
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { activeItemId: 'locked-item' },
      select: { id: true },
    });
  });
});

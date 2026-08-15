import type { Prisma } from '@veilfall/database';

type TemperingLookup = Pick<Prisma.TransactionClient, 'temperingJob'>;

export async function canItemPerformInventoryAction(
  database: TemperingLookup,
  itemId: string,
): Promise<boolean> {
  const activeProcess = await database.temperingJob.findUnique({
    where: { activeItemId: itemId },
    select: { id: true },
  });
  return activeProcess === null;
}

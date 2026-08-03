import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/prisma/client.js'
export { Prisma } from './generated/prisma/client.js'

export function createPrismaClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg(connectionString) })
}

export type VeilfallPrismaClient = ReturnType<typeof createPrismaClient>

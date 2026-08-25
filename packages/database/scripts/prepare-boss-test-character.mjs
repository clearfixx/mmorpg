import { config } from 'dotenv'

import { createPrismaClient } from '../dist/index.js'

config({ path: '../../.env' })

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value) args.set(key, value)
}

const email = args.get('--email')?.trim().toLowerCase()
const confirmation = args.get('--confirm')
const connectionString = process.env.DATABASE_URL

if (!email || confirmation !== 'PREPARE-LOCAL-HERO') {
  throw new Error(
    'Usage: pnpm test:prepare-boss -- --email player@example.com --confirm PREPARE-LOCAL-HERO',
  )
}
if (!connectionString) throw new Error('DATABASE_URL is required')

const databaseUrl = new URL(connectionString)
if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('This fixture is restricted to a local database')
}

const prisma = createPrismaClient(connectionString)
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      character: {
        select: { id: true, name: true, level: true, experience: true },
      },
    },
  })
  if (!user?.character) throw new Error('Character not found for this email')

  const targetLevel = 30
  const targetExperience = 100 * (targetLevel - 1) ** 2
  const result = await prisma.$transaction(async (tx) => {
    const character = await tx.character.update({
      where: { id: user.character.id },
      data: {
        level: { set: Math.max(user.character.level, targetLevel) },
        experience: {
          set: Math.max(user.character.experience, targetExperience),
        },
        version: { increment: 1 },
      },
      select: { name: true, level: true, experience: true },
    })
    await tx.characterWorldState.update({
      where: { characterId: user.character.id },
      data: {
        rareEncounterWeek: null,
        rareEncounterChecks: 0,
        rareEncounterCount: 0,
        version: { increment: 1 },
      },
    })
    return character
  })

  console.log(
    `Prepared ${result.name}: level ${result.level}, experience ${result.experience}; rare encounter cycle reset.`,
  )
} finally {
  await prisma.$disconnect()
}

import {
  ClanDevelopmentBranch,
  ClanRole,
  ResourceType,
  WorldLocation,
} from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { CreateClanInput } from './dto/create-clan.input';
import { ContributeClanResourceInput } from './dto/contribute-clan-resource.input';
import { JoinClanInput } from './dto/join-clan.input';
import { UpgradeClanDevelopmentInput } from './dto/upgrade-clan-development.input';
import { ClanModel } from './models/clan.model';

const DEVELOPMENT_DEFINITIONS = {
  [ClanDevelopmentBranch.MILITARY]: {
    name: 'Військовий шлях',
    description: 'Відкриває бойові споруди, спроби босів і захисні бонуси.',
  },
  [ClanDevelopmentBranch.HUNTING]: {
    name: 'Мисливський шлях',
    description: 'Покращує розвідку, відомості про ворогів і кланову здобич.',
  },
  [ClanDevelopmentBranch.CRAFTING]: {
    name: 'Ремісничий шлях',
    description: 'Відкриває кузню, рецепти та ефективніше вдосконалення речей.',
  },
  [ClanDevelopmentBranch.ECONOMIC]: {
    name: 'Економічний шлях',
    description: 'Розвиває сховища, торгівлю та місткість клану.',
  },
  [ClanDevelopmentBranch.MYSTIC]: {
    name: 'Містичний шлях',
    description: 'Готує доступ до рун, зачарувань і сезонних печер.',
  },
} as const;

@Injectable()
export class ClansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<ClanModel | null> {
    const characterId = await this.characters.requireIdForUser(userId);
    return this.readForCharacter(characterId);
  }

  async create(userId: string, input: CreateClanInput): Promise<ClanModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const name = input.name.normalize('NFC').trim().replace(/\s+/g, ' ');
    const nameKey = name.toLocaleLowerCase('uk-UA');
    const payloadHash = this.hash(`CREATE:${nameKey}`);
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        characterId,
        existing.payloadHash,
        payloadHash,
      );

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const character = await tx.character.findUniqueOrThrow({
          where: { id: characterId },
          include: { clanMembership: true, worldState: true },
        });
        if (character.clanMembership)
          throw new ConflictException('Character already belongs to a clan');
        if (
          character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException('Clans are managed in Cinderhaven');
        const updated = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Character state changed');
        const clan = await tx.clan.create({
          data: {
            name,
            nameKey,
            inviteCode: randomBytes(4).toString('hex').toUpperCase(),
          },
        });
        await tx.clanMembership.create({
          data: { clanId: clan.id, characterId, role: ClanRole.LEADER },
        });
        await tx.clanCommand.create({
          data: {
            clanId: clan.id,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'CREATE_CLAN',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return (await this.readForCharacter(characterId))!;
  }

  async join(userId: string, input: JoinClanInput): Promise<ClanModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const inviteCode = input.inviteCode.toUpperCase();
    const payloadHash = this.hash(`JOIN:${inviteCode}`);
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        characterId,
        existing.payloadHash,
        payloadHash,
      );

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const [character, clan] = await Promise.all([
          tx.character.findUniqueOrThrow({
            where: { id: characterId },
            include: { clanMembership: true, worldState: true },
          }),
          tx.clan.findUnique({ where: { inviteCode } }),
        ]);
        if (!clan) throw new BadRequestException('Clan invite code is invalid');
        if (character.clanMembership)
          throw new ConflictException('Character already belongs to a clan');
        if (
          character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException('Clans are managed in Cinderhaven');
        const updated = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Character state changed');
        await tx.clanMembership.create({
          data: { clanId: clan.id, characterId },
        });
        await tx.clan.update({
          where: { id: clan.id },
          data: { version: { increment: 1 } },
        });
        await tx.clanCommand.create({
          data: {
            clanId: clan.id,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'JOIN_CLAN',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return (await this.readForCharacter(characterId))!;
  }

  async contribute(
    userId: string,
    input: ContributeClanResourceInput,
  ): Promise<ClanModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(
      `CONTRIBUTE:${input.resourceType}:${input.amount}:${input.expectedClanVersion}`,
    );
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        characterId,
        existing.payloadHash,
        payloadHash,
      );

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const membership = await tx.clanMembership.findUnique({
          where: { characterId },
          include: {
            character: { include: { worldState: true } },
            clan: true,
          },
        });
        if (!membership)
          throw new BadRequestException('Clan membership required');
        if (
          membership.character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException(
            'Clan treasury is managed in Cinderhaven',
          );

        const paid = await tx.characterResource.updateMany({
          where: {
            characterId,
            type: input.resourceType,
            balance: { gte: input.amount },
          },
          data: { balance: { decrement: input.amount } },
        });
        if (paid.count !== 1)
          throw new ConflictException('Not enough personal resources');
        const characterUpdated = await tx.character.updateMany({
          where: { id: characterId, version: input.expectedCharacterVersion },
          data: { version: { increment: 1 } },
        });
        if (characterUpdated.count !== 1)
          throw new ConflictException('Character state changed');

        const experienceGain =
          input.amount * this.resourceWeight(input.resourceType);
        const progression = this.progressionFor(
          membership.clan.experience + experienceGain,
        );
        const clanUpdated = await tx.clan.updateMany({
          where: {
            id: membership.clanId,
            version: input.expectedClanVersion,
          },
          data: {
            experience: { increment: experienceGain },
            level: progression.level,
            version: { increment: 1 },
          },
        });
        if (clanUpdated.count !== 1)
          throw new ConflictException('Clan state changed');

        await tx.clanResource.upsert({
          where: {
            clanId_type: {
              clanId: membership.clanId,
              type: input.resourceType,
            },
          },
          create: {
            clanId: membership.clanId,
            type: input.resourceType,
            balance: input.amount,
          },
          update: { balance: { increment: input.amount } },
        });
        await tx.clanMembership.update({
          where: { characterId },
          data: { contribution: { increment: experienceGain } },
        });
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type: input.resourceType,
            amount: -input.amount,
            reason: 'CLAN_CONTRIBUTION',
            referenceId: input.idempotencyKey,
          },
        });
        await tx.clanContribution.create({
          data: {
            clanId: membership.clanId,
            characterId,
            resourceType: input.resourceType,
            amount: input.amount,
            experienceGain,
            referenceId: input.idempotencyKey,
          },
        });
        await tx.clanCommand.create({
          data: {
            clanId: membership.clanId,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'CONTRIBUTE_RESOURCE',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return (await this.readForCharacter(characterId))!;
  }

  async upgradeDevelopment(
    userId: string,
    input: UpgradeClanDevelopmentInput,
  ): Promise<ClanModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(
      `DEVELOP:${input.branch}:${input.expectedClanVersion}`,
    );
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        characterId,
        existing.payloadHash,
        payloadHash,
      );

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const membership = await tx.clanMembership.findUnique({
          where: { characterId },
          include: {
            character: { include: { worldState: true } },
            clan: { include: { developments: true } },
          },
        });
        if (!membership)
          throw new BadRequestException('Clan membership required');
        if (membership.role !== ClanRole.LEADER)
          throw new ConflictException(
            'Only the clan leader can develop branches',
          );
        if (
          membership.character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException(
            'Clan development is managed in Cinderhaven',
          );
        const currentRank =
          membership.clan.developments.find(
            (development) => development.branch === input.branch,
          )?.rank ?? 0;
        if (currentRank >= 3)
          throw new ConflictException('Development branch is complete');
        const cost = this.developmentCost(currentRank + 1);
        if (membership.clan.level < cost.requiredClanLevel)
          throw new ConflictException('Clan level is too low');

        const paid = await tx.clanResource.updateMany({
          where: {
            clanId: membership.clanId,
            type: cost.resource,
            balance: { gte: cost.amount },
          },
          data: { balance: { decrement: cost.amount } },
        });
        if (paid.count !== 1)
          throw new ConflictException('Clan treasury lacks resources');
        const updated = await tx.clan.updateMany({
          where: {
            id: membership.clanId,
            version: input.expectedClanVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Clan state changed');
        await tx.clanDevelopment.upsert({
          where: {
            clanId_branch: {
              clanId: membership.clanId,
              branch: input.branch,
            },
          },
          create: {
            clanId: membership.clanId,
            branch: input.branch,
            rank: 1,
          },
          update: { rank: { increment: 1 } },
        });
        await tx.clanCommand.create({
          data: {
            clanId: membership.clanId,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'UPGRADE_DEVELOPMENT',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return (await this.readForCharacter(characterId))!;
  }

  private async readForCharacter(
    characterId: string,
  ): Promise<ClanModel | null> {
    const membership = await this.prisma.client.clanMembership.findUnique({
      where: { characterId },
      include: {
        character: { select: { version: true } },
        clan: {
          include: {
            resources: true,
            developments: true,
            members: {
              orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
              include: {
                character: { select: { id: true, name: true, level: true } },
              },
            },
          },
        },
      },
    });
    if (!membership) return null;
    return {
      id: membership.clan.id,
      name: membership.clan.name,
      inviteCode: membership.clan.inviteCode,
      experience: membership.clan.experience,
      ...this.progressionFor(membership.clan.experience),
      version: membership.clan.version,
      characterVersion: membership.character.version,
      viewerRole: membership.role,
      members: membership.clan.members.map((member) => ({
        characterId: member.character.id,
        name: member.character.name,
        level: member.character.level,
        role: member.role,
        joinedAt: member.joinedAt,
        contribution: member.contribution,
      })),
      treasury: Object.values(ResourceType).map((type) => ({
        type,
        amount:
          membership.clan.resources.find((resource) => resource.type === type)
            ?.balance ?? 0,
      })),
      developments: Object.values(ClanDevelopmentBranch).map((branch) => {
        const rank =
          membership.clan.developments.find(
            (development) => development.branch === branch,
          )?.rank ?? 0;
        const cost = this.developmentCost(Math.min(3, rank + 1));
        const balance =
          membership.clan.resources.find(
            (resource) => resource.type === cost.resource,
          )?.balance ?? 0;
        return {
          branch,
          ...DEVELOPMENT_DEFINITIONS[branch],
          rank,
          maxRank: 3,
          requiredClanLevel: cost.requiredClanLevel,
          costResource: cost.resource,
          costAmount: cost.amount,
          affordable: balance >= cost.amount,
          unlocked: membership.clan.level >= cost.requiredClanLevel,
        };
      }),
    };
  }

  private findCommand(characterId: string, idempotencyKey: string) {
    return this.prisma.client.clanCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
  }

  private async resolveExisting(
    characterId: string,
    storedHash: string,
    requestedHash: string,
  ): Promise<ClanModel> {
    if (storedHash !== requestedHash)
      throw new ConflictException(
        'Command key was used for another clan action',
      );
    const clan = await this.readForCharacter(characterId);
    if (!clan) throw new ConflictException('Clan state changed');
    return clan;
  }

  private hash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  private resourceWeight(type: ResourceType): number {
    return {
      [ResourceType.IRON]: 1,
      [ResourceType.COPPER]: 3,
      [ResourceType.BRONZE]: 8,
    }[type];
  }

  private progressionFor(experience: number): {
    level: number;
    experienceIntoLevel: number;
    experienceForNextLevel: number;
  } {
    let level = 1;
    let spent = 0;
    let threshold = 250;
    while (experience - spent >= threshold) {
      spent += threshold;
      level += 1;
      threshold = level * 250;
    }
    return {
      level,
      experienceIntoLevel: experience - spent,
      experienceForNextLevel: threshold,
    };
  }

  private developmentCost(rank: number): {
    resource: ResourceType;
    amount: number;
    requiredClanLevel: number;
  } {
    if (rank >= 3)
      return {
        resource: ResourceType.BRONZE,
        amount: 20,
        requiredClanLevel: 3,
      };
    if (rank === 2)
      return {
        resource: ResourceType.COPPER,
        amount: 30,
        requiredClanLevel: 2,
      };
    return {
      resource: ResourceType.IRON,
      amount: 20,
      requiredClanLevel: 1,
    };
  }
}

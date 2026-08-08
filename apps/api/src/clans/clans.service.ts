import { ClanRole, WorldLocation } from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { CreateClanInput } from './dto/create-clan.input';
import { JoinClanInput } from './dto/join-clan.input';
import { ClanModel } from './models/clan.model';

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

  private async readForCharacter(
    characterId: string,
  ): Promise<ClanModel | null> {
    const membership = await this.prisma.client.clanMembership.findUnique({
      where: { characterId },
      include: {
        character: { select: { version: true } },
        clan: {
          include: {
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
      level: membership.clan.level,
      experience: membership.clan.experience,
      version: membership.clan.version,
      characterVersion: membership.character.version,
      viewerRole: membership.role,
      members: membership.clan.members.map((member) => ({
        characterId: member.character.id,
        name: member.character.name,
        level: member.character.level,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
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
}

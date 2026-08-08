import {
  CharacterArchetype,
  ClanBossStatus,
  ClanDevelopmentBranch,
  ClanRole,
  Prisma,
  TalentType,
  WorldLocation,
} from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { AttackClanBossInput } from './dto/attack-clan-boss.input';
import { SummonClanBossInput } from './dto/summon-clan-boss.input';
import { ClanBossModel } from './models/clan-boss.model';

type BossWithParticipants = Prisma.ClanBossEncounterGetPayload<{
  include: {
    participants: { include: { character: { select: { name: true } } } };
  };
}>;

@Injectable()
export class ClanBossesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async current(userId: string): Promise<ClanBossModel | null> {
    const characterId = await this.characters.requireIdForUser(userId);
    const membership = await this.prisma.client.clanMembership.findUnique({
      where: { characterId },
    });
    if (!membership) return null;
    const boss = await this.prisma.client.clanBossEncounter.findFirst({
      where: { clanId: membership.clanId },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: {
          orderBy: { damage: 'desc' },
          include: { character: { select: { name: true } } },
        },
      },
    });
    return boss
      ? this.toModel(boss, membership.role === ClanRole.LEADER)
      : null;
  }

  async summon(
    userId: string,
    input: SummonClanBossInput,
  ): Promise<ClanBossModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(`SUMMON:${input.expectedClanVersion}`);
    const prior = await this.findCommand(characterId, input.idempotencyKey);
    if (prior)
      return this.resolveExisting(characterId, prior.payloadHash, payloadHash);
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const member = await tx.clanMembership.findUnique({
          where: { characterId },
          include: {
            character: { include: { worldState: true } },
            clan: { include: { developments: true } },
          },
        });
        if (!member || member.role !== ClanRole.LEADER)
          throw new ConflictException('Only the clan leader can summon a boss');
        if (
          member.character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException('Boss lair is reached from Cinderhaven');
        const military =
          member.clan.developments.find(
            (entry) => entry.branch === ClanDevelopmentBranch.MILITARY,
          )?.rank ?? 0;
        if (military < 1)
          throw new ConflictException(
            'Military development rank one is required',
          );
        const updated = await tx.clan.updateMany({
          where: { id: member.clanId, version: input.expectedClanVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Clan state changed');
        await tx.clanBossEncounter.create({
          data: {
            clanId: member.clanId,
            activeClanId: member.clanId,
            maxHealth: 500,
            currentHealth: 500,
          },
        });
        await tx.clanCommand.create({
          data: {
            clanId: member.clanId,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'SUMMON_BOSS',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return (await this.current(userId))!;
  }

  async attack(
    userId: string,
    input: AttackClanBossInput,
  ): Promise<ClanBossModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(
      `ATTACK:${input.encounterId}:${input.expectedVersion}`,
    );
    const prior = await this.findCommand(characterId, input.idempotencyKey);
    if (prior)
      return this.resolveEncounter(
        characterId,
        input.encounterId,
        prior.payloadHash,
        payloadHash,
      );
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const [member, boss, character] = await Promise.all([
          tx.clanMembership.findUnique({ where: { characterId } }),
          tx.clanBossEncounter.findUnique({ where: { id: input.encounterId } }),
          tx.character.findUniqueOrThrow({
            where: { id: characterId },
            include: {
              worldState: true,
              talents: true,
              equipment: {
                where: { slot: 'MAIN_HAND' },
                include: { item: true },
              },
            },
          }),
        ]);
        if (!member || !boss || boss.clanId !== member.clanId)
          throw new BadRequestException('Active clan boss required');
        if (boss.status !== ClanBossStatus.ACTIVE)
          throw new ConflictException('Clan boss is no longer active');
        if (
          character.worldState?.currentLocation !==
          WorldLocation.CINDERHAVEN_GATE
        )
          throw new ConflictException('Return to Cinderhaven to fight');
        const damage = this.damageFor(character);
        const remaining = Math.max(0, boss.currentHealth - damage);
        const updated = await tx.clanBossEncounter.updateMany({
          where: {
            id: boss.id,
            version: input.expectedVersion,
            status: ClanBossStatus.ACTIVE,
          },
          data: {
            currentHealth: remaining,
            version: { increment: 1 },
            ...(remaining === 0
              ? {
                  status: ClanBossStatus.WON,
                  activeClanId: null,
                  completedAt: new Date(),
                }
              : {}),
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Boss state changed');
        await tx.clanBossParticipant.upsert({
          where: {
            encounterId_characterId: { encounterId: boss.id, characterId },
          },
          create: { encounterId: boss.id, characterId, damage, actions: 1 },
          update: { damage: { increment: damage }, actions: { increment: 1 } },
        });
        await tx.clanCommand.create({
          data: {
            clanId: member.clanId,
            characterId,
            idempotencyKey: input.idempotencyKey,
            commandType: 'ATTACK_BOSS',
            payloadHash,
          },
        });
      });
    } catch (error) {
      const raced = await this.findCommand(characterId, input.idempotencyKey);
      if (!raced || raced.payloadHash !== payloadHash) throw error;
    }
    return this.readEncounter(characterId, input.encounterId);
  }

  private damageFor(character: {
    archetype: CharacterArchetype;
    level: number;
    talents: Array<{ type: TalentType; rank: number }>;
    equipment: Array<{ item: { damage: number } }>;
  }): number {
    const base = { VANGUARD: 16, RANGER: 19, ARCANIST: 21 }[
      character.archetype
    ];
    const power =
      character.talents.find((talent) => talent.type === TalentType.POWER)
        ?.rank ?? 0;
    return (
      base +
      (character.level - 1) * 2 +
      power * 3 +
      (character.equipment[0]?.item.damage ?? 0)
    );
  }

  private async readEncounter(
    characterId: string,
    encounterId: string,
  ): Promise<ClanBossModel> {
    const member = await this.prisma.client.clanMembership.findUniqueOrThrow({
      where: { characterId },
    });
    const boss = await this.prisma.client.clanBossEncounter.findFirstOrThrow({
      where: { id: encounterId, clanId: member.clanId },
      include: {
        participants: {
          orderBy: { damage: 'desc' },
          include: { character: { select: { name: true } } },
        },
      },
    });
    return this.toModel(boss, member.role === ClanRole.LEADER);
  }
  private async resolveExisting(
    characterId: string,
    stored: string,
    requested: string,
  ) {
    if (stored !== requested)
      throw new ConflictException('Command key was reused');
    const member = await this.prisma.client.clanMembership.findUniqueOrThrow({
      where: { characterId },
    });
    const boss = await this.prisma.client.clanBossEncounter.findFirstOrThrow({
      where: { clanId: member.clanId },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: { include: { character: { select: { name: true } } } },
      },
    });
    return this.toModel(boss, member.role === ClanRole.LEADER);
  }
  private async resolveEncounter(
    characterId: string,
    encounterId: string,
    stored: string,
    requested: string,
  ) {
    if (stored !== requested)
      throw new ConflictException('Command key was reused');
    return this.readEncounter(characterId, encounterId);
  }
  private findCommand(characterId: string, idempotencyKey: string) {
    return this.prisma.client.clanCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private toModel(
    boss: BossWithParticipants,
    canSummon: boolean,
  ): ClanBossModel {
    return {
      id: boss.id,
      name: 'Кістяний велетень',
      tier: boss.tier,
      status: boss.status,
      maxHealth: boss.maxHealth,
      currentHealth: boss.currentHealth,
      version: boss.version,
      canSummon,
      participants: boss.participants.map((entry) => ({
        characterId: entry.characterId,
        name: entry.character.name,
        damage: entry.damage,
        actions: entry.actions,
      })),
    };
  }
}

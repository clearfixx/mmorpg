import {
  CharacterArchetype,
  ClanBossStatus,
  ClanDevelopmentBranch,
  ClanRole,
  Prisma,
  ResourceType,
  TalentType,
  WorldLocation,
} from '@veilfall/database';
import { levelBonuses, talentBonuses } from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { AttackClanBossInput } from './dto/attack-clan-boss.input';
import { ClaimClanBossRewardInput } from './dto/claim-clan-boss-reward.input';
import { SummonClanBossInput } from './dto/summon-clan-boss.input';
import { ClanBossModel } from './models/clan-boss.model';

type BossWithParticipants = Prisma.ClanBossEncounterGetPayload<{
  include: {
    participants: {
      include: {
        character: { select: { name: true } };
        rewardClaim: true;
      };
    };
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
      include: { clan: { include: { developments: true } } },
    });
    if (!membership) return null;
    const boss = await this.prisma.client.clanBossEncounter.findFirst({
      where: { clanId: membership.clanId },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: {
          orderBy: { damage: 'desc' },
          include: {
            character: { select: { name: true } },
            rewardClaim: true,
          },
        },
      },
    });
    return boss
      ? this.toModel(
          boss,
          membership.role === ClanRole.LEADER,
          characterId,
          this.militaryRank(membership.clan.developments),
        )
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
        const latest = await tx.clanBossEncounter.findFirst({
          where: { clanId: member.clanId },
          orderBy: { createdAt: 'desc' },
          include: { participants: { include: { rewardClaim: true } } },
        });
        if (latest?.status === ClanBossStatus.ACTIVE)
          throw new ConflictException('The current clan boss is still active');
        if (
          latest?.status === ClanBossStatus.WON &&
          latest.participants.some((participant) => !participant.rewardClaim)
        )
          throw new ConflictException(
            'All participants must claim the previous reward',
          );
        const nextTier =
          latest?.status === ClanBossStatus.WON
            ? latest.tier + 1
            : (latest?.tier ?? 1);
        if (nextTier > military)
          throw new ConflictException(
            'Improve the military clan branch for the next boss tier',
          );
        const maxHealth = this.healthForTier(nextTier);
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
            tier: nextTier,
            maxHealth,
            currentHealth: maxHealth,
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
        const [member, boss, character, participation] = await Promise.all([
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
          tx.clanBossParticipant.findUnique({
            where: {
              encounterId_characterId: {
                encounterId: input.encounterId,
                characterId,
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
        if (participation && participation.currentHealth <= 0)
          throw new ConflictException('This hero was defeated by the boss');
        const damage = this.damageFor(character);
        const remaining = Math.max(0, boss.currentHealth - damage);
        const actualDamage = Math.min(damage, boss.currentHealth);
        const durability = this.durabilityFor(character);
        const healthBefore = participation?.currentHealth ?? durability.health;
        const retaliation =
          remaining === 0
            ? 0
            : Math.max(1, this.bossDamageForTier(boss.tier) - durability.armor);
        const healthAfter = Math.max(0, healthBefore - retaliation);
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
          create: {
            encounterId: boss.id,
            characterId,
            damage: actualDamage,
            actions: 1,
            maxHealth: durability.health,
            currentHealth: healthAfter,
            defeatedAt: healthAfter === 0 ? new Date() : null,
          },
          update: {
            damage: { increment: actualDamage },
            actions: { increment: 1 },
            currentHealth: healthAfter,
            defeatedAt: healthAfter === 0 ? new Date() : undefined,
          },
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

  async claimReward(
    userId: string,
    input: ClaimClanBossRewardInput,
  ): Promise<ClanBossModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const existing = await this.prisma.client.clanBossRewardClaim.findUnique({
      where: {
        encounterId_characterId: {
          encounterId: input.encounterId,
          characterId,
        },
      },
    });
    if (!existing) {
      try {
        await this.prisma.client.$transaction(async (tx) => {
          const participant = await tx.clanBossParticipant.findUnique({
            where: {
              encounterId_characterId: {
                encounterId: input.encounterId,
                characterId,
              },
            },
            include: { encounter: true },
          });
          if (!participant || participant.actions < 1 || participant.damage < 1)
            throw new BadRequestException(
              'Only battle participants can claim this reward',
            );
          if (participant.encounter.status !== ClanBossStatus.WON)
            throw new ConflictException('The clan boss is not defeated');
          const amount = this.rewardAmount(participant.encounter.tier);
          const claim = await tx.clanBossRewardClaim.create({
            data: {
              encounterId: input.encounterId,
              characterId,
              participantId: participant.id,
              idempotencyKey: input.idempotencyKey,
              resourceType: ResourceType.VEIL_ECHO,
              resourceAmount: amount,
            },
          });
          await tx.characterResource.upsert({
            where: {
              characterId_type: {
                characterId,
                type: ResourceType.VEIL_ECHO,
              },
            },
            create: {
              characterId,
              type: ResourceType.VEIL_ECHO,
              balance: amount,
            },
            update: { balance: { increment: amount } },
          });
          await tx.resourceLedgerEntry.create({
            data: {
              characterId,
              type: ResourceType.VEIL_ECHO,
              amount,
              reason: 'CLAN_BOSS_REWARD',
              referenceId: claim.id,
            },
          });
          await tx.character.update({
            where: { id: characterId },
            data: { version: { increment: 1 } },
          });
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        const raced = await this.prisma.client.clanBossRewardClaim.findUnique({
          where: {
            encounterId_characterId: {
              encounterId: input.encounterId,
              characterId,
            },
          },
        });
        if (!raced)
          throw new ConflictException('Reward claim conflicted; retry');
      }
    }
    return this.readEncounter(characterId, input.encounterId);
  }

  private rewardAmount(tier: number): number {
    return 5 * 2 ** (tier - 1);
  }

  private healthForTier(tier: number): number {
    return 500 * 3 ** (tier - 1);
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
    const ascendedPower =
      character.talents.find(
        (talent) => talent.type === TalentType.ASCENDED_POWER,
      )?.rank ?? 0;
    return (
      base +
      (character.level - 1) * 2 +
      power * 3 +
      ascendedPower * 8 +
      (character.equipment[0]?.item.damage ?? 0)
    );
  }

  private durabilityFor(character: {
    archetype: CharacterArchetype;
    level: number;
    talents: Array<{ type: TalentType; rank: number }>;
  }): { health: number; armor: number } {
    const bases = {
      [CharacterArchetype.VANGUARD]: { health: 140, armor: 14 },
      [CharacterArchetype.RANGER]: { health: 100, armor: 7 },
      [CharacterArchetype.ARCANIST]: { health: 90, armor: 5 },
    };
    const ranks = Object.fromEntries(
      character.talents.map((talent) => [talent.type, talent.rank]),
    );
    const basic = talentBonuses({
      vitality: ranks[TalentType.VITALITY] ?? 0,
      power: 0,
      resilience: ranks[TalentType.RESILIENCE] ?? 0,
    });
    const level = levelBonuses(character.level);
    return {
      health:
        bases[character.archetype].health +
        level.health +
        basic.health +
        (ranks[TalentType.ASCENDED_VITALITY] ?? 0) * 30,
      armor:
        bases[character.archetype].armor +
        level.armor +
        basic.armor +
        (ranks[TalentType.ASCENDED_RESILIENCE] ?? 0) * 6,
    };
  }

  private bossDamageForTier(tier: number): number {
    return Math.round(28 * 2.5 ** (tier - 1));
  }

  private async readEncounter(
    characterId: string,
    encounterId: string,
  ): Promise<ClanBossModel> {
    const member = await this.prisma.client.clanMembership.findUniqueOrThrow({
      where: { characterId },
      include: { clan: { include: { developments: true } } },
    });
    const boss = await this.prisma.client.clanBossEncounter.findFirstOrThrow({
      where: { id: encounterId, clanId: member.clanId },
      include: {
        participants: {
          orderBy: { damage: 'desc' },
          include: {
            character: { select: { name: true } },
            rewardClaim: true,
          },
        },
      },
    });
    return this.toModel(
      boss,
      member.role === ClanRole.LEADER,
      characterId,
      this.militaryRank(member.clan.developments),
    );
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
      include: { clan: { include: { developments: true } } },
    });
    const boss = await this.prisma.client.clanBossEncounter.findFirstOrThrow({
      where: { clanId: member.clanId },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: {
          include: {
            character: { select: { name: true } },
            rewardClaim: true,
          },
        },
      },
    });
    return this.toModel(
      boss,
      member.role === ClanRole.LEADER,
      characterId,
      this.militaryRank(member.clan.developments),
    );
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
    viewerCharacterId: string,
    militaryRank: number,
  ): ClanBossModel {
    const viewerParticipation = boss.participants.find(
      (entry) => entry.characterId === viewerCharacterId,
    );
    const rewardsPending = boss.participants.some(
      (participant) => !participant.rewardClaim,
    );
    const nextTier =
      boss.status === ClanBossStatus.WON ? boss.tier + 1 : boss.tier;
    const canSummonNext =
      canSummon &&
      boss.status !== ClanBossStatus.ACTIVE &&
      !rewardsPending &&
      nextTier <= militaryRank;
    return {
      id: boss.id,
      name: 'Кістяний велетень',
      tier: boss.tier,
      status: boss.status,
      maxHealth: boss.maxHealth,
      currentHealth: boss.currentHealth,
      version: boss.version,
      canSummon: canSummonNext,
      nextTier,
      nextMaxHealth: this.healthForTier(nextTier),
      summonLockedReason: this.summonLockedReason({
        isLeader: canSummon,
        status: boss.status,
        rewardsPending,
        nextTier,
        militaryRank,
      }),
      viewerEligibleForReward:
        boss.status === ClanBossStatus.WON &&
        (viewerParticipation?.actions ?? 0) > 0 &&
        (viewerParticipation?.damage ?? 0) > 0,
      viewerRewardClaimed: Boolean(viewerParticipation?.rewardClaim),
      viewerCanAttack:
        boss.status === ClanBossStatus.ACTIVE &&
        (viewerParticipation?.currentHealth ?? 1) > 0,
      viewerCurrentHealth: viewerParticipation?.currentHealth ?? 0,
      viewerMaxHealth: viewerParticipation?.maxHealth ?? 0,
      rewardType: ResourceType.VEIL_ECHO,
      rewardAmount: this.rewardAmount(boss.tier),
      participants: boss.participants.map((entry) => ({
        characterId: entry.characterId,
        name: entry.character.name,
        damage: entry.damage,
        actions: entry.actions,
        maxHealth: entry.maxHealth,
        currentHealth: entry.currentHealth,
        defeated: entry.currentHealth <= 0,
      })),
    };
  }

  private militaryRank(
    developments: Array<{ branch: ClanDevelopmentBranch; rank: number }>,
  ): number {
    return (
      developments.find(
        (development) => development.branch === ClanDevelopmentBranch.MILITARY,
      )?.rank ?? 0
    );
  }

  private summonLockedReason(input: {
    isLeader: boolean;
    status: ClanBossStatus;
    rewardsPending: boolean;
    nextTier: number;
    militaryRank: number;
  }): string | null {
    if (!input.isLeader) return 'Наступного боса викликає голова клану.';
    if (input.status === ClanBossStatus.ACTIVE)
      return 'Спочатку здолайте поточного боса.';
    if (input.rewardsPending)
      return 'Усі учасники мають забрати нагороду попереднього бою.';
    if (input.nextTier > input.militaryRank)
      return `Потрібен ${input.nextTier} ранг військового шляху.`;
    return null;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}

import { Prisma } from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { AdjustCharacterResourceInput } from './dto/adjust-character-resource.input';
import { SetCharacterLevelInput } from './dto/set-character-level.input';
import {
  AdminAuditLogModel,
  AdminCharacterModel,
  AdminMutationResultModel,
} from './models/admin.models';

const characterInclude = {
  user: { select: { email: true, role: true } },
  resources: {
    select: { type: true, balance: true },
    orderBy: { type: 'asc' },
  },
} satisfies Prisma.CharacterInclude;

type CharacterWithAdminData = Prisma.CharacterGetPayload<{
  include: typeof characterInclude;
}>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async characters(search = '', take = 50): Promise<AdminCharacterModel[]> {
    const query = search.trim();
    const characters = await this.prisma.client.character.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { user: { email: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: characterInclude,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(100, Math.max(1, Math.floor(take))),
    });
    return characters.map((character) => this.toCharacter(character));
  }

  async auditLogs(targetId: string | undefined, take = 50) {
    const logs = await this.prisma.client.adminAuditLog.findMany({
      where: targetId ? { targetId } : undefined,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Math.floor(take))),
    });
    return logs.map((log): AdminAuditLogModel => ({
      id: log.id,
      actorEmail: log.actor.email,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      createdAt: log.createdAt,
    }));
  }

  async adjustResource(
    actorUserId: string,
    input: AdjustCharacterResourceInput,
  ): Promise<AdminMutationResultModel> {
    if (input.delta === 0)
      throw new BadRequestException('Resource delta cannot be zero');
    const payloadHash = this.hash({
      action: 'ADJUST_CHARACTER_RESOURCE',
      characterId: input.characterId,
      resourceType: input.resourceType,
      delta: input.delta,
      reason: input.reason,
    });
    const replay = await this.replay(
      actorUserId,
      input.idempotencyKey,
      payloadHash,
    );
    if (replay) return replay;

    try {
      const auditId = await this.prisma.client.$transaction(async (tx) => {
        await tx.character.findUniqueOrThrow({
          where: { id: input.characterId },
          select: { id: true },
        });
        const current = await tx.characterResource.findUnique({
          where: {
            characterId_type: {
              characterId: input.characterId,
              type: input.resourceType,
            },
          },
        });
        const before = current?.balance ?? 0;
        const after = before + input.delta;
        if (after < 0)
          throw new BadRequestException('Resource balance cannot be negative');
        const audit = await tx.adminAuditLog.create({
          data: {
            actorUserId,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
            action: 'ADJUST_CHARACTER_RESOURCE',
            targetType: 'CHARACTER',
            targetId: input.characterId,
            reason: input.reason.trim(),
            before: { resourceType: input.resourceType, balance: before },
            after: { resourceType: input.resourceType, balance: after },
          },
        });
        await tx.characterResource.upsert({
          where: {
            characterId_type: {
              characterId: input.characterId,
              type: input.resourceType,
            },
          },
          create: {
            characterId: input.characterId,
            type: input.resourceType,
            balance: after,
          },
          update: { balance: after },
        });
        await tx.resourceLedgerEntry.create({
          data: {
            characterId: input.characterId,
            type: input.resourceType,
            amount: input.delta,
            reason: 'ADMIN_ADJUSTMENT',
            referenceId: audit.id,
          },
        });
        await tx.character.update({
          where: { id: input.characterId },
          data: { version: { increment: 1 } },
        });
        return audit.id;
      });
      return this.result(auditId, input.characterId);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const raced = await this.replay(
        actorUserId,
        input.idempotencyKey,
        payloadHash,
      );
      if (!raced) throw new ConflictException('Admin command conflicted');
      return raced;
    }
  }

  async setLevel(
    actorUserId: string,
    input: SetCharacterLevelInput,
  ): Promise<AdminMutationResultModel> {
    const payloadHash = this.hash({
      action: 'SET_CHARACTER_LEVEL',
      characterId: input.characterId,
      level: input.level,
      reason: input.reason,
    });
    const replay = await this.replay(
      actorUserId,
      input.idempotencyKey,
      payloadHash,
    );
    if (replay) return replay;

    try {
      const auditId = await this.prisma.client.$transaction(async (tx) => {
        const current = await tx.character.findUniqueOrThrow({
          where: { id: input.characterId },
          select: { level: true, experience: true },
        });
        const experience = 100 * (input.level - 1) ** 2;
        const audit = await tx.adminAuditLog.create({
          data: {
            actorUserId,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
            action: 'SET_CHARACTER_LEVEL',
            targetType: 'CHARACTER',
            targetId: input.characterId,
            reason: input.reason.trim(),
            before: current,
            after: { level: input.level, experience },
          },
        });
        await tx.character.update({
          where: { id: input.characterId },
          data: {
            level: input.level,
            experience,
            version: { increment: 1 },
          },
        });
        return audit.id;
      });
      return this.result(auditId, input.characterId);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const raced = await this.replay(
        actorUserId,
        input.idempotencyKey,
        payloadHash,
      );
      if (!raced) throw new ConflictException('Admin command conflicted');
      return raced;
    }
  }

  private async replay(
    actorUserId: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<AdminMutationResultModel | null> {
    const audit = await this.prisma.client.adminAuditLog.findUnique({
      where: {
        actorUserId_idempotencyKey: { actorUserId, idempotencyKey },
      },
    });
    if (!audit) return null;
    if (audit.payloadHash !== payloadHash)
      throw new ConflictException('Admin command key was already used');
    return this.result(audit.id, audit.targetId);
  }

  private async result(auditId: string, characterId: string) {
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      include: characterInclude,
    });
    return { auditId, character: this.toCharacter(character) };
  }

  private toCharacter(character: CharacterWithAdminData): AdminCharacterModel {
    return {
      id: character.id,
      name: character.name,
      email: character.user.email,
      userRole: character.user.role,
      level: character.level,
      experience: character.experience,
      gold: character.gold,
      version: character.version,
      resources: character.resources.map((resource) => ({
        type: resource.type,
        amount: resource.balance,
      })),
    };
  }

  private hash(payload: object): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

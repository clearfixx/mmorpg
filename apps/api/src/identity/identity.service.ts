import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import type { SafeViewer } from './identity.types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async register(
    email: string,
    password: string,
    response: Response,
  ): Promise<SafeViewer> {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await this.passwords.hash(password);

    try {
      const user = await this.prisma.client.user.create({
        data: { email: normalizedEmail, passwordHash },
        select: { id: true, email: true, role: true, createdAt: true },
      });
      await this.sessions.start(user.id, response);
      return user;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Account cannot be created with these credentials',
        );
      throw error;
    }
  }

  async login(
    email: string,
    password: string,
    response: Response,
  ): Promise<SafeViewer> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    const valid = await this.passwords.verify(
      password,
      user?.passwordHash ?? null,
    );

    if (!user || !valid || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.sessions.start(user.id, response);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

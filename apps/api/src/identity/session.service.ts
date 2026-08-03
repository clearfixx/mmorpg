import { UserStatus } from '@veilfall/database';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { PrismaService } from '../database/prisma.service';
import type { SafeViewer } from './identity.types';
import { SessionTokenService } from './session-token.service';

const COOKIE_NAME = 'veilfall_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }

  return undefined;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: SessionTokenService,
  ) {}

  async start(userId: string, response: Response): Promise<void> {
    const token = this.tokens.create();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.client.session.create({
      data: { userId, tokenHash: this.tokens.hash(token), expiresAt },
    });

    response.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    });
  }

  async viewer(request: Request): Promise<SafeViewer | null> {
    const token = readCookie(request, COOKIE_NAME);
    if (!token) return null;

    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash: this.tokens.hash(token) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      createdAt: session.user.createdAt,
    };
  }

  async requireViewer(request: Request): Promise<SafeViewer> {
    const viewer = await this.viewer(request);
    if (!viewer) throw new UnauthorizedException('Authentication required');
    return viewer;
  }

  async end(request: Request, response: Response): Promise<void> {
    const token = readCookie(request, COOKIE_NAME);
    if (token) {
      await this.prisma.client.session.updateMany({
        where: { tokenHash: this.tokens.hash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}

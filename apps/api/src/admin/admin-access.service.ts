import { UserRole } from '@veilfall/database';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../identity/session.service';
import type { SafeViewer } from '../identity/identity.types';

const READ_ROLES = new Set<UserRole>([
  UserRole.SUPPORT,
  UserRole.MODERATOR,
  UserRole.ADMIN,
  UserRole.ROOT_OWNER,
]);
const WRITE_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.ROOT_OWNER]);

@Injectable()
export class AdminAccessService {
  constructor(private readonly sessions: SessionService) {}

  async requireRead(request: Request): Promise<SafeViewer> {
    const viewer = await this.sessions.requireViewer(request);
    if (!READ_ROLES.has(viewer.role))
      throw new ForbiddenException('Administrative access required');
    return viewer;
  }

  async requireWrite(request: Request): Promise<SafeViewer> {
    const viewer = await this.sessions.requireViewer(request);
    if (!WRITE_ROLES.has(viewer.role))
      throw new ForbiddenException('Administrator role required');
    return viewer;
  }
}

import { createPrismaClient } from '@veilfall/database';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { requireEnvironment } from '../common/environment';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly client = createPrismaClient(requireEnvironment('DATABASE_URL'));

  async onApplicationShutdown() {
    await this.client.$disconnect();
  }
}

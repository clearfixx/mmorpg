import { ResourceType } from '@veilfall/database';
import { Injectable } from '@nestjs/common';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { ResourceBalanceModel } from './models/resource-balance.model';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<ResourceBalanceModel[]> {
    const characterId = await this.characters.requireIdForUser(userId);
    const resources = await this.prisma.client.characterResource.findMany({
      where: { characterId },
    });
    const balances = new Map(
      resources.map((entry) => [entry.type, entry.balance]),
    );
    return Object.values(ResourceType).map((type) => ({
      type,
      amount: balances.get(type) ?? 0,
    }));
  }
}

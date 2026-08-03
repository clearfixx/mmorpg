import {
  AvatarMode,
  CharacterArchetype,
  CharacterOrigin,
} from '@veilfall/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CharacterNameService } from './character-name.service';
import { CreateCharacterInput } from './dto/create-character.input';
import { CharacterModel } from './models/character.model';

const STATIC_AVATARS = new Set([
  'standard-01',
  'standard-02',
  'standard-03',
  'standard-04',
  'standard-05',
]);

const BASE_STATS = {
  [CharacterArchetype.VANGUARD]: {
    health: 140,
    damage: 16,
    armor: 14,
    speed: 8,
    reaction: 8,
  },
  [CharacterArchetype.RANGER]: {
    health: 100,
    damage: 19,
    armor: 7,
    speed: 14,
    reaction: 13,
  },
  [CharacterArchetype.ARCANIST]: {
    health: 90,
    damage: 21,
    armor: 6,
    speed: 10,
    reaction: 12,
  },
} as const;

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly names: CharacterNameService,
  ) {}

  async findForUser(userId: string): Promise<CharacterModel | null> {
    const character = await this.prisma.client.character.findUnique({
      where: { userId },
      include: { equipment: { include: { item: true } } },
    });
    return character ? this.toModel(character) : null;
  }

  async create(
    userId: string,
    input: CreateCharacterInput,
  ): Promise<CharacterModel> {
    const { name, nameKey } = this.names.normalize(input.name);
    const staticAvatarId = this.validateAvatar(
      input.avatarMode,
      input.staticAvatarId,
    );

    try {
      const character = await this.prisma.client.character.create({
        data: {
          userId,
          name,
          nameKey,
          archetype: input.archetype,
          origin: input.origin ?? CharacterOrigin.ROAD_SURVIVOR,
          avatarMode: input.avatarMode,
          staticAvatarId,
          worldState: { create: {} },
        },
      });
      return this.toModel(character);
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('Character or name is already registered');
      throw error;
    }
  }

  async requireIdForUser(userId: string): Promise<string> {
    const character = await this.prisma.client.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!character) throw new BadRequestException('Create a character first');
    return character.id;
  }

  private validateAvatar(
    mode: AvatarMode,
    staticAvatarId?: string,
  ): string | null {
    if (mode === AvatarMode.DYNAMIC) {
      if (staticAvatarId)
        throw new BadRequestException(
          'Dynamic avatar cannot use a static avatar identifier',
        );
      return null;
    }
    if (!staticAvatarId || !STATIC_AVATARS.has(staticAvatarId))
      throw new BadRequestException('Static avatar is unavailable');
    return staticAvatarId;
  }

  private toModel(character: {
    id: string;
    name: string;
    archetype: CharacterArchetype;
    origin: CharacterOrigin;
    avatarMode: AvatarMode;
    staticAvatarId: string | null;
    level: number;
    experience: number;
    version: number;
    createdAt: Date;
    equipment?: Array<{ item: { damage: number } }>;
  }): CharacterModel {
    const weaponDamage = character.equipment?.[0]?.item.damage ?? 0;
    return {
      ...character,
      baseStats: {
        ...BASE_STATS[character.archetype],
        damage: BASE_STATS[character.archetype].damage + weaponDamage,
      },
    };
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

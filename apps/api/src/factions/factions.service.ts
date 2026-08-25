import { WorldFaction } from '@veilfall/database';
import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { ChooseFactionInput } from './dto/choose-faction.input';
import { FactionStateModel } from './models/faction-state.model';

@Injectable()
export class FactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<FactionStateModel> {
    return this.read(await this.characters.requireIdForUser(userId));
  }

  async choose(userId: string, input: ChooseFactionInput) {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = createHash('sha256')
      .update(
        `CHOOSE_FACTION:${input.faction}:${input.expectedCharacterVersion}`,
      )
      .digest('hex');
    const existing = await this.prisma.client.factionCommand.findUnique({
      where: {
        characterId_idempotencyKey: {
          characterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException('Command key was used for another choice');
      return this.read(characterId);
    }

    await this.prisma.client.$transaction(async (tx) => {
      const character = await tx.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { faction: true, factionChanges: true },
      });
      if (character.faction === input.faction)
        throw new ConflictException('This faction is already selected');
      if (character.faction && character.factionChanges >= 1)
        throw new ConflictException('Faction change has already been used');
      const updated = await tx.character.updateMany({
        where: { id: characterId, version: input.expectedCharacterVersion },
        data: {
          faction: input.faction,
          factionChanges: character.faction
            ? { increment: 1 }
            : character.factionChanges,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Character state changed; refresh and retry',
        );
      await tx.factionCommand.create({
        data: {
          characterId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          faction: input.faction,
        },
      });
    });
    return this.read(characterId);
  }

  private async read(characterId: string): Promise<FactionStateModel> {
    const character = await this.prisma.client.character.findUniqueOrThrow({
      where: { id: characterId },
      select: {
        faction: true,
        factionChanges: true,
        version: true,
        level: true,
      },
    });
    const hour = Math.floor(Date.now() / 3_600_000);
    const dawnControls = hour % 2 === 0;
    const shift = (hour % 5) + 1;
    const bandMin = Math.floor(Math.max(0, character.level - 1) / 10) * 10 + 1;
    return {
      faction: character.faction,
      characterVersion: character.version,
      canChangeFaction: character.factionChanges < 1,
      dawnStrength: dawnControls ? 100 + shift : 100 - shift,
      ashenStrength: dawnControls ? 100 - shift : 100 + shift,
      contestedLocation: 'Зламана застава',
      controllingFaction: dawnControls
        ? WorldFaction.DAWN_COVENANT
        : WorldFaction.ASHEN_HOST,
      frontLevelMin: bandMin,
      frontLevelMax: bandMin + 9,
      nextScriptedShiftAt: new Date((hour + 1) * 3_600_000),
    };
  }
}

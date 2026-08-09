import { CraftJobStatus } from '@veilfall/database';
import {
  CRAFTING_RECIPES,
  craftingDurationSeconds,
  craftingRecipe,
  resourceDefinition,
  scaledIngredients,
} from '@veilfall/game-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../database/prisma.service';
import { ClaimCraftInput } from './dto/claim-craft.input';
import { StartCraftInput } from './dto/start-craft.input';
import { CraftingStateModel } from './models/crafting.model';

@Injectable()
export class CraftingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async forUser(userId: string): Promise<CraftingStateModel> {
    return this.read(await this.characters.requireIdForUser(userId));
  }

  async start(
    userId: string,
    input: StartCraftInput,
  ): Promise<CraftingStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const recipe = craftingRecipe(input.recipeId);
    if (!recipe) throw new BadRequestException('Recipe is unknown');
    if (!recipe.public) {
      const knowledge =
        await this.prisma.client.characterRecipeKnowledge.findUnique({
          where: {
            characterId_recipeId: { characterId, recipeId: recipe.id },
          },
        });
      if (!knowledge) throw new BadRequestException('Recipe is unknown');
    }
    const payloadHash = this.hash(`START:${recipe.id}:${input.quantity}`);
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        existing.payloadHash,
        payloadHash,
        characterId,
      );

    await this.prisma.client.$transaction(async (tx) => {
      const balances = await tx.characterResource.findMany({
        where: { characterId },
      });
      const balanceMap = new Map(
        balances.map((balance) => [balance.type, balance.balance]),
      );
      const ingredients = scaledIngredients(recipe, input.quantity);
      for (const ingredient of ingredients) {
        if ((balanceMap.get(ingredient.resourceType) ?? 0) < ingredient.amount)
          throw new ConflictException('Not enough crafting resources');
      }
      const active = await tx.craftJob.findFirst({
        where: {
          characterId,
          activeStation: recipe.station,
        },
      });
      if (active) throw new ConflictException('Crafting station is occupied');
      const startedAt = new Date();
      const completesAt = new Date(
        startedAt.getTime() +
          craftingDurationSeconds(recipe, input.quantity) * 1_000,
      );
      const job = await tx.craftJob.create({
        data: {
          characterId,
          recipeId: recipe.id,
          station: recipe.station,
          activeStation: recipe.station,
          quantity: input.quantity,
          outputType: recipe.output.resourceType,
          outputAmount: recipe.output.amount * input.quantity,
          startedAt,
          completesAt,
        },
      });
      for (const ingredient of ingredients) {
        const type = ingredient.resourceType;
        const debited = await tx.characterResource.updateMany({
          where: {
            characterId,
            type,
            balance: { gte: ingredient.amount },
          },
          data: { balance: { decrement: ingredient.amount } },
        });
        if (debited.count !== 1)
          throw new ConflictException('Crafting resources changed');
        await tx.resourceLedgerEntry.create({
          data: {
            characterId,
            type,
            amount: -ingredient.amount,
            reason: 'CRAFT_START',
            referenceId: job.id,
          },
        });
      }
      await tx.craftCommand.create({
        data: {
          characterId,
          idempotencyKey: input.idempotencyKey,
          commandType: 'START_CRAFT',
          payloadHash,
          craftJobId: job.id,
        },
      });
    });
    return this.read(characterId);
  }

  async claim(
    userId: string,
    input: ClaimCraftInput,
  ): Promise<CraftingStateModel> {
    const characterId = await this.characters.requireIdForUser(userId);
    const payloadHash = this.hash(`CLAIM:${input.craftJobId}`);
    const existing = await this.findCommand(characterId, input.idempotencyKey);
    if (existing)
      return this.resolveExisting(
        existing.payloadHash,
        payloadHash,
        characterId,
      );

    await this.prisma.client.$transaction(async (tx) => {
      const job = await tx.craftJob.findFirst({
        where: {
          id: input.craftJobId,
          characterId,
          status: CraftJobStatus.ACTIVE,
        },
      });
      if (!job) throw new BadRequestException('Crafting job is unavailable');
      if (job.completesAt > new Date())
        throw new ConflictException('Crafting is not complete');
      await tx.characterResource.upsert({
        where: {
          characterId_type: { characterId, type: job.outputType },
        },
        create: {
          characterId,
          type: job.outputType,
          balance: job.outputAmount,
        },
        update: { balance: { increment: job.outputAmount } },
      });
      await tx.resourceLedgerEntry.create({
        data: {
          characterId,
          type: job.outputType,
          amount: job.outputAmount,
          reason: 'CRAFT_OUTPUT',
          referenceId: job.id,
        },
      });
      await tx.craftJob.update({
        where: { id: job.id },
        data: {
          status: CraftJobStatus.CLAIMED,
          activeStation: null,
          claimedAt: new Date(),
        },
      });
      if (job.outputType === 'STABILIZED_CATALYST') {
        await tx.characterRecipeKnowledge.upsert({
          where: {
            characterId_recipeId: {
              characterId,
              recipeId: 'tempered-veil-steel-v1',
            },
          },
          create: {
            characterId,
            recipeId: 'tempered-veil-steel-v1',
            source: 'CATALYST_MASTERY',
          },
          update: {},
        });
      }
      await tx.craftCommand.create({
        data: {
          characterId,
          idempotencyKey: input.idempotencyKey,
          commandType: 'CLAIM_CRAFT',
          payloadHash,
          craftJobId: job.id,
        },
      });
    });
    return this.read(characterId);
  }

  private async read(characterId: string): Promise<CraftingStateModel> {
    const [balances, jobs, knowledge] = await Promise.all([
      this.prisma.client.characterResource.findMany({ where: { characterId } }),
      this.prisma.client.craftJob.findMany({
        where: { characterId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      this.prisma.client.characterRecipeKnowledge.findMany({
        where: { characterId },
      }),
    ]);
    const balanceMap = new Map(
      balances.map((balance) => [balance.type, balance.balance]),
    );
    const occupied = new Set(
      jobs
        .filter((job) => job.activeStation !== null)
        .map((job) => job.activeStation),
    );
    const knownRecipeIds = new Set(knowledge.map((entry) => entry.recipeId));
    return {
      recipes: Object.values(CRAFTING_RECIPES)
        .filter((recipe) => recipe.public || knownRecipeIds.has(recipe.id))
        .map((recipe) => {
          const ingredients = recipe.ingredients.map((ingredient) => ({
            resourceType: ingredient.resourceType,
            name: resourceDefinition(ingredient.resourceType).name,
            amount: ingredient.amount,
            available: balanceMap.get(ingredient.resourceType) ?? 0,
          }));
          return {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            station: recipe.station,
            durationSeconds: recipe.durationSeconds,
            ingredients,
            outputType: recipe.output.resourceType,
            outputName: resourceDefinition(recipe.output.resourceType).name,
            outputAmount: recipe.output.amount,
            affordable: ingredients.every(
              (ingredient) => ingredient.available >= ingredient.amount,
            ),
            stationAvailable: !occupied.has(recipe.station),
            discovered: !recipe.public,
          };
        }),
      jobs: jobs.map((job) => {
        const recipe = craftingRecipe(job.recipeId);
        const remainingSeconds = Math.max(
          0,
          Math.ceil((job.completesAt.getTime() - Date.now()) / 1_000),
        );
        return {
          id: job.id,
          recipeId: job.recipeId,
          recipeName: recipe?.name ?? job.recipeId,
          station: job.station,
          status: job.status,
          quantity: job.quantity,
          outputType: job.outputType,
          outputName: resourceDefinition(job.outputType).name,
          outputAmount: job.outputAmount,
          startedAt: job.startedAt,
          completesAt: job.completesAt,
          remainingSeconds,
          ready: job.status === CraftJobStatus.ACTIVE && remainingSeconds === 0,
        };
      }),
    };
  }

  private findCommand(characterId: string, idempotencyKey: string) {
    return this.prisma.client.craftCommand.findUnique({
      where: { characterId_idempotencyKey: { characterId, idempotencyKey } },
    });
  }

  private async resolveExisting(
    storedHash: string,
    requestedHash: string,
    characterId: string,
  ): Promise<CraftingStateModel> {
    if (storedHash !== requestedHash)
      throw new ConflictException('Command key was used for another craft');
    return this.read(characterId);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

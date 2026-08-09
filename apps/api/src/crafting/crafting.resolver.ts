import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { CraftingService } from './crafting.service';
import { ClaimCraftInput } from './dto/claim-craft.input';
import { StartCraftInput } from './dto/start-craft.input';
import { CraftingStateModel } from './models/crafting.model';

@Resolver(() => CraftingStateModel)
export class CraftingResolver {
  constructor(
    private readonly crafting: CraftingService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => CraftingStateModel)
  async myCrafting(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.crafting.forUser(viewer.id);
  }

  @Mutation(() => CraftingStateModel)
  async startCraft(
    @Args('input') input: StartCraftInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.crafting.start(viewer.id, input);
  }

  @Mutation(() => CraftingStateModel)
  async claimCraft(
    @Args('input') input: ClaimCraftInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.crafting.claim(viewer.id, input);
  }
}

import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { ChooseFactionInput } from './dto/choose-faction.input';
import { FactionsService } from './factions.service';
import { FactionStateModel } from './models/faction-state.model';

@Resolver(() => FactionStateModel)
export class FactionsResolver {
  constructor(
    private readonly factions: FactionsService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => FactionStateModel)
  async myFaction(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.factions.forUser(viewer.id);
  }

  @Mutation(() => FactionStateModel)
  async chooseFaction(
    @Args('input') input: ChooseFactionInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.factions.choose(viewer.id, input);
  }
}

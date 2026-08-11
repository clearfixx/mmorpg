import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { PrepareLocationInput } from './dto/prepare-location.input';
import { TravelInput } from './dto/travel.input';
import { WorldMapModel, WorldStateModel } from './models/world-state.model';
import { WorldService } from './world.service';

@Resolver(() => WorldStateModel)
export class WorldResolver {
  constructor(
    private readonly world: WorldService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => WorldStateModel)
  async currentLocation(
    @Context() context: GraphqlContext,
  ): Promise<WorldStateModel> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.world.currentForUser(viewer.id);
  }

  @Query(() => WorldMapModel)
  async worldMap(@Context() context: GraphqlContext): Promise<WorldMapModel> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.world.mapForUser(viewer.id);
  }

  @Mutation(() => WorldStateModel)
  async performLocationAction(
    @Args('input') input: PrepareLocationInput,
    @Context() context: GraphqlContext,
  ): Promise<WorldStateModel> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.world.prepare(viewer.id, input);
  }

  @Mutation(() => WorldStateModel)
  async travel(
    @Args('input') input: TravelInput,
    @Context() context: GraphqlContext,
  ): Promise<WorldStateModel> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.world.travel(viewer.id, input);
  }
}

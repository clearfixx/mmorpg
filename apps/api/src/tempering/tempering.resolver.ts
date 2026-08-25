import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { ResolveTemperingInput } from './dto/resolve-tempering.input';
import { StartTemperingInput } from './dto/start-tempering.input';
import { TemperingStateModel } from './models/tempering.model';
import { TemperingService } from './tempering.service';

@Resolver(() => TemperingStateModel)
export class TemperingResolver {
  constructor(
    private readonly tempering: TemperingService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => TemperingStateModel)
  async myTempering(
    @Args('itemId', { type: () => String, nullable: true })
    itemId: string | null,
    @Args('accelerationPercent', { type: () => Int, nullable: true })
    accelerationPercent: number | null,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.tempering.forUser(viewer.id, itemId, accelerationPercent ?? 0);
  }

  @Mutation(() => TemperingStateModel)
  async startTempering(
    @Args('input') input: StartTemperingInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.tempering.start(viewer.id, input);
  }

  @Mutation(() => TemperingStateModel)
  async completeTempering(
    @Args('input') input: ResolveTemperingInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.tempering.complete(viewer.id, input);
  }

  @Mutation(() => TemperingStateModel)
  async cancelTempering(
    @Args('input') input: ResolveTemperingInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.tempering.cancel(viewer.id, input);
  }
}

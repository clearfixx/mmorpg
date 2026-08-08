import { Context, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { ResourceBalanceModel } from './models/resource-balance.model';
import { ResourcesService } from './resources.service';

@Resolver(() => ResourceBalanceModel)
export class ResourcesResolver {
  constructor(
    private readonly resources: ResourcesService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => [ResourceBalanceModel])
  async myResources(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.resources.forUser(viewer.id);
  }
}

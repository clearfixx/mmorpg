import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { UpgradeTalentInput } from './dto/upgrade-talent.input';
import { TalentTreeModel } from './models/talent-tree.model';
import { TalentsService } from './talents.service';

@Resolver(() => TalentTreeModel)
export class TalentsResolver {
  constructor(
    private readonly talents: TalentsService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => TalentTreeModel)
  async myTalents(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.talents.forUser(viewer.id);
  }

  @Mutation(() => TalentTreeModel)
  async upgradeTalent(
    @Args('input') input: UpgradeTalentInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.talents.upgrade(viewer.id, input);
  }
}

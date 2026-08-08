import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { GraphqlContext } from '../identity/identity.types';
import { SessionService } from '../identity/session.service';
import { ClansService } from './clans.service';
import { CreateClanInput } from './dto/create-clan.input';
import { ContributeClanResourceInput } from './dto/contribute-clan-resource.input';
import { JoinClanInput } from './dto/join-clan.input';
import { UpgradeClanDevelopmentInput } from './dto/upgrade-clan-development.input';
import { ClanModel } from './models/clan.model';

@Resolver(() => ClanModel)
export class ClansResolver {
  constructor(
    private readonly clans: ClansService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => ClanModel, { nullable: true })
  async myClan(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.clans.forUser(viewer.id);
  }

  @Mutation(() => ClanModel)
  async createClan(
    @Args('input') input: CreateClanInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.clans.create(viewer.id, input);
  }

  @Mutation(() => ClanModel)
  async joinClan(
    @Args('input') input: JoinClanInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.clans.join(viewer.id, input);
  }

  @Mutation(() => ClanModel)
  async contributeClanResource(
    @Args('input') input: ContributeClanResourceInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.clans.contribute(viewer.id, input);
  }

  @Mutation(() => ClanModel)
  async upgradeClanDevelopment(
    @Args('input') input: UpgradeClanDevelopmentInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.clans.upgradeDevelopment(viewer.id, input);
  }
}

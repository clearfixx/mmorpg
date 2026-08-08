import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { GraphqlContext } from '../identity/identity.types';
import { SessionService } from '../identity/session.service';
import { ClanBossesService } from './clan-bosses.service';
import { AttackClanBossInput } from './dto/attack-clan-boss.input';
import { ClaimClanBossRewardInput } from './dto/claim-clan-boss-reward.input';
import { SummonClanBossInput } from './dto/summon-clan-boss.input';
import { ClanBossModel } from './models/clan-boss.model';

@Resolver(() => ClanBossModel)
export class ClanBossesResolver {
  constructor(
    private readonly bosses: ClanBossesService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => ClanBossModel, { nullable: true })
  async currentClanBoss(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.bosses.current(viewer.id);
  }

  @Mutation(() => ClanBossModel)
  async summonClanBoss(
    @Args('input') input: SummonClanBossInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.bosses.summon(viewer.id, input);
  }

  @Mutation(() => ClanBossModel)
  async attackClanBoss(
    @Args('input') input: AttackClanBossInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.bosses.attack(viewer.id, input);
  }

  @Mutation(() => ClanBossModel)
  async claimClanBossReward(
    @Args('input') input: ClaimClanBossRewardInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.bosses.claimReward(viewer.id, input);
  }
}

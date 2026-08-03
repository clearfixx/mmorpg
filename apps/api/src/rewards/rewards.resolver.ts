import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { ClaimBattleRewardInput } from './dto/claim-battle-reward.input';
import { BattleRewardModel } from './models/battle-reward.model';
import { RewardsService } from './rewards.service';

@Resolver(() => BattleRewardModel)
export class RewardsResolver {
  constructor(
    private readonly rewards: RewardsService,
    private readonly sessions: SessionService,
  ) {}

  @Mutation(() => BattleRewardModel)
  async claimBattleReward(
    @Args('input') input: ClaimBattleRewardInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.rewards.claim(viewer.id, input);
  }
}

import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { RetreatInput } from './dto/retreat.input';
import { StartEncounterInput } from './dto/start-encounter.input';
import { SubmitCombatCommandInput } from './dto/submit-combat-command.input';
import { BattleModel } from './models/battle.model';
import { CombatService } from './combat.service';

@Resolver(() => BattleModel)
export class CombatResolver {
  constructor(
    private readonly combat: CombatService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => BattleModel, { nullable: true })
  async activeBattle(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.activeForUser(viewer.id);
  }

  @Query(() => BattleModel, { nullable: true })
  async latestBattle(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.latestForUser(viewer.id);
  }

  @Mutation(() => BattleModel)
  async startEncounter(
    @Args('input') _input: StartEncounterInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.start(viewer.id);
  }

  @Mutation(() => BattleModel)
  async submitCombatCommand(
    @Args('input') input: SubmitCombatCommandInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.submit(viewer.id, input);
  }

  @Mutation(() => BattleModel)
  async retreatFromBattle(
    @Args('input') input: RetreatInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.retreat(viewer.id, input.expectedVersion);
  }

  @Mutation(() => Boolean)
  async returnToWatchpost(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.combat.returnToWatchpost(viewer.id);
  }
}

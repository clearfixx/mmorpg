import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { CreateMarketListingInput } from './dto/create-market-listing.input';
import { MarketListingCommandInput } from './dto/market-listing-command.input';
import { MarketplaceModel } from './models/marketplace.model';
import { MarketService } from './market.service';

@Resolver(() => MarketplaceModel)
export class MarketResolver {
  constructor(
    private readonly market: MarketService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => MarketplaceModel)
  async marketplace(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.forUser(viewer.id);
  }

  @Mutation(() => MarketplaceModel)
  async createMarketListing(
    @Args('input') input: CreateMarketListingInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.createListing(viewer.id, input);
  }

  @Mutation(() => MarketplaceModel)
  async cancelMarketListing(
    @Args('input') input: MarketListingCommandInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.cancelListing(viewer.id, input);
  }

  @Mutation(() => MarketplaceModel)
  async buyMarketListing(
    @Args('input') input: MarketListingCommandInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.buyListing(viewer.id, input);
  }
}

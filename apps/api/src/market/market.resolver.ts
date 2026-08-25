import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { CreateMarketListingInput } from './dto/create-market-listing.input';
import { CreateMarketResourceListingInput } from './dto/create-market-resource-listing.input';
import { MarketBrowseInput } from './dto/market-browse.input';
import { MarketListingCommandInput } from './dto/market-listing-command.input';
import { MarketQuoteInput } from './dto/market-quote.input';
import { MarketplaceModel, MarketQuoteModel } from './models/marketplace.model';
import { MarketService } from './market.service';

@Resolver(() => MarketplaceModel)
export class MarketResolver {
  constructor(
    private readonly market: MarketService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => MarketplaceModel)
  async marketplace(
    @Args('input', { type: () => MarketBrowseInput, nullable: true })
    input: MarketBrowseInput | null,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.forUser(viewer.id, input ?? undefined);
  }

  @Query(() => MarketQuoteModel)
  async marketQuote(
    @Args('input') input: MarketQuoteInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.quote(viewer.id, input);
  }

  @Mutation(() => MarketplaceModel)
  async createMarketResourceListing(
    @Args('input') input: CreateMarketResourceListingInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.market.createResourceListing(viewer.id, input);
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

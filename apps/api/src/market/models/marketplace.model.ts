import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { InventoryItemModel } from '../../inventory/models/inventory.model';

@ObjectType()
export class MarketListingModel {
  @Field(() => ID) id!: string;
  @Field(() => InventoryItemModel) item!: InventoryItemModel;
  @Field(() => Int) price!: number;
  @Field(() => Int) deposit!: number;
  @Field() status!: string;
  @Field() expiresAt!: Date;
  @Field() createdAt!: Date;
  @Field(() => Boolean) own!: boolean;
}

@ObjectType()
export class MarketHistoryEntryModel {
  @Field(() => ID) id!: string;
  @Field(() => InventoryItemModel) item!: InventoryItemModel;
  @Field(() => Int) price!: number;
  @Field() status!: string;
  @Field() role!: string;
  @Field() completedAt!: Date;
}

@ObjectType()
export class MarketplaceModel {
  @Field(() => Int) balance!: number;
  @Field(() => Int) listingDeposit!: number;
  @Field(() => [MarketListingModel]) listings!: MarketListingModel[];
  @Field(() => [MarketListingModel]) myListings!: MarketListingModel[];
  @Field(() => [MarketHistoryEntryModel]) history!: MarketHistoryEntryModel[];
}

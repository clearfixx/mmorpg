import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { InventoryItemModel } from '../../inventory/models/inventory.model';
import { ResourceBalanceModel } from '../../resources/models/resource-balance.model';

@ObjectType()
export class MarketListingModel {
  @Field(() => ID) id!: string;
  @Field(() => InventoryItemModel, { nullable: true })
  item!: InventoryItemModel | null;
  @Field(() => ResourceBalanceModel, { nullable: true })
  resource!: ResourceBalanceModel | null;
  @Field(() => Int) price!: number;
  @Field(() => Int) deposit!: number;
  @Field(() => Int) minimumPrice!: number;
  @Field(() => Int, { nullable: true }) referencePrice!: number | null;
  @Field(() => Int) comparableSales!: number;
  @Field() status!: string;
  @Field() expiresAt!: Date;
  @Field() createdAt!: Date;
  @Field(() => Boolean) own!: boolean;
}

@ObjectType()
export class MarketHistoryEntryModel {
  @Field(() => ID) id!: string;
  @Field(() => InventoryItemModel, { nullable: true })
  item!: InventoryItemModel | null;
  @Field(() => ResourceBalanceModel, { nullable: true })
  resource!: ResourceBalanceModel | null;
  @Field(() => Int) price!: number;
  @Field(() => Int) saleFee!: number;
  @Field(() => Int) sellerProceeds!: number;
  @Field() status!: string;
  @Field() role!: string;
  @Field() completedAt!: Date;
}

@ObjectType()
export class MarketplaceModel {
  @Field(() => Int) balance!: number;
  @Field(() => Int) listingDeposit!: number;
  @Field(() => Int) saleFeePercent!: number;
  @Field(() => Int) page!: number;
  @Field(() => Int) totalPages!: number;
  @Field(() => Int) totalListings!: number;
  @Field(() => [MarketListingModel]) listings!: MarketListingModel[];
  @Field(() => [MarketListingModel]) myListings!: MarketListingModel[];
  @Field(() => [MarketHistoryEntryModel]) history!: MarketHistoryEntryModel[];
}

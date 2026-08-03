import { ItemBinding, ItemRarity } from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ItemRarity, { name: 'ItemRarity' });
registerEnumType(ItemBinding, { name: 'ItemBinding' });

@ObjectType()
export class RewardItemModel {
  @Field(() => ID) id!: string;
  @Field() definitionId!: string;
  @Field() name!: string;
  @Field(() => Int) itemLevel!: number;
  @Field(() => ItemRarity) rarity!: ItemRarity;
  @Field(() => Int) damage!: number;
  @Field(() => ItemBinding) binding!: ItemBinding;
  @Field() setName!: string;
  @Field() visualAssetId!: string;
}

@ObjectType()
export class BattleRewardModel {
  @Field(() => ID) claimId!: string;
  @Field(() => ID) battleId!: string;
  @Field(() => Int) experience!: number;
  @Field(() => Int) gold!: number;
  @Field(() => RewardItemModel) item!: RewardItemModel;
}

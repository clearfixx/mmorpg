import {
  EquipmentSlot,
  ItemBinding,
  ItemLocation,
  ItemRarity,
} from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { ResourceBalanceModel } from '../../resources/models/resource-balance.model';

registerEnumType(ItemRarity, { name: 'ItemRarity' });
registerEnumType(ItemBinding, { name: 'ItemBinding' });
registerEnumType(ItemLocation, { name: 'ItemLocation' });

@ObjectType()
export class RewardItemModel {
  @Field(() => ID) id!: string;
  @Field() definitionId!: string;
  @Field() name!: string;
  @Field(() => Int) itemLevel!: number;
  @Field(() => ItemRarity) rarity!: ItemRarity;
  @Field(() => Int) rollQuality!: number;
  @Field(() => Int) damage!: number;
  @Field(() => Int) armor!: number;
  @Field(() => Int) health!: number;
  @Field(() => Int) damageMin!: number;
  @Field(() => Int) damageMax!: number;
  @Field(() => [EquipmentSlot]) compatibleSlots!: EquipmentSlot[];
  @Field(() => ItemBinding) binding!: ItemBinding;
  @Field(() => ItemLocation) location!: ItemLocation;
  @Field() setName!: string;
  @Field() visualAssetId!: string;
}

@ObjectType()
export class BattleRewardModel {
  @Field(() => ID) claimId!: string;
  @Field(() => ID) battleId!: string;
  @Field(() => Int) experience!: number;
  @Field(() => Int) gold!: number;
  @Field(() => [ResourceBalanceModel]) resources!: ResourceBalanceModel[];
  @Field(() => RewardItemModel) item!: RewardItemModel;
}

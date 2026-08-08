import { ResourceType, TalentType } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { ResourceBalanceModel } from '../../resources/models/resource-balance.model';

registerEnumType(TalentType, { name: 'TalentType' });

@ObjectType()
export class TalentNodeModel {
  @Field(() => TalentType)
  type!: TalentType;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => Int)
  rank!: number;

  @Field(() => Int)
  maxRank!: number;

  @Field(() => Int)
  requiredLevel!: number;

  @Field(() => Int)
  effectPerRank!: number;

  @Field()
  unlocked!: boolean;

  @Field()
  advanced!: boolean;

  @Field(() => ResourceType)
  costResource!: ResourceType;

  @Field(() => Int)
  costAmount!: number;

  @Field()
  affordable!: boolean;
}

@ObjectType()
export class TalentTreeModel {
  @Field(() => Int)
  characterVersion!: number;

  @Field(() => Int)
  availablePoints!: number;

  @Field(() => [TalentNodeModel])
  talents!: TalentNodeModel[];

  @Field(() => [ResourceBalanceModel])
  resources!: ResourceBalanceModel[];
}

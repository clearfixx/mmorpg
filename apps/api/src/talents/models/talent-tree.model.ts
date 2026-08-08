import { TalentType } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

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
}

@ObjectType()
export class TalentTreeModel {
  @Field(() => Int)
  characterVersion!: number;

  @Field(() => Int)
  availablePoints!: number;

  @Field(() => [TalentNodeModel])
  talents!: TalentNodeModel[];
}

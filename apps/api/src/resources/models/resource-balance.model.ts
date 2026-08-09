import { ResourceType } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ResourceType, { name: 'ResourceType' });

export enum ResourceOrigin {
  DROPPED = 'DROPPED',
  CRAFTED = 'CRAFTED',
  BOSS_EXCLUSIVE = 'BOSS_EXCLUSIVE',
}

export enum ResourceRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  MYTHIC = 'MYTHIC',
  DIVINE = 'DIVINE',
}

registerEnumType(ResourceOrigin, { name: 'ResourceOrigin' });
registerEnumType(ResourceRarity, { name: 'ResourceRarity' });

@ObjectType()
export class ResourceBalanceModel {
  @Field(() => ResourceType)
  type!: ResourceType;

  @Field(() => Int)
  amount!: number;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => ResourceOrigin)
  origin!: ResourceOrigin;

  @Field(() => ResourceRarity)
  rarity!: ResourceRarity;

  @Field()
  tradeable!: boolean;

  @Field()
  clanContributable!: boolean;
}

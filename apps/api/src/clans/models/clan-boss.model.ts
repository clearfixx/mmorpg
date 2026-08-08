import { ClanBossStatus } from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ClanBossStatus, { name: 'ClanBossStatus' });

@ObjectType()
export class ClanBossParticipantModel {
  @Field(() => ID)
  characterId!: string;
  @Field()
  name!: string;
  @Field(() => Int)
  damage!: number;
  @Field(() => Int)
  actions!: number;
}

@ObjectType()
export class ClanBossModel {
  @Field(() => ID)
  id!: string;
  @Field()
  name!: string;
  @Field(() => Int)
  tier!: number;
  @Field(() => ClanBossStatus)
  status!: ClanBossStatus;
  @Field(() => Int)
  maxHealth!: number;
  @Field(() => Int)
  currentHealth!: number;
  @Field(() => Int)
  version!: number;
  @Field()
  canSummon!: boolean;
  @Field(() => [ClanBossParticipantModel])
  participants!: ClanBossParticipantModel[];
}

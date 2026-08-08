import {
  ClanDevelopmentBranch,
  ClanRole,
  ResourceType,
} from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ClanRole, { name: 'ClanRole' });
registerEnumType(ResourceType, { name: 'ResourceType' });
registerEnumType(ClanDevelopmentBranch, { name: 'ClanDevelopmentBranch' });

@ObjectType()
export class ClanDevelopmentModel {
  @Field(() => ClanDevelopmentBranch)
  branch!: ClanDevelopmentBranch;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => Int)
  rank!: number;

  @Field(() => Int)
  maxRank!: number;

  @Field(() => Int)
  requiredClanLevel!: number;

  @Field(() => ResourceType)
  costResource!: ResourceType;

  @Field(() => Int)
  costAmount!: number;

  @Field()
  affordable!: boolean;

  @Field()
  unlocked!: boolean;
}

@ObjectType()
export class ClanResourceModel {
  @Field(() => ResourceType)
  type!: ResourceType;

  @Field(() => Int)
  amount!: number;
}

@ObjectType()
export class ClanMemberModel {
  @Field(() => ID)
  characterId!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => ClanRole)
  role!: ClanRole;

  @Field()
  joinedAt!: Date;

  @Field(() => Int)
  contribution!: number;
}

@ObjectType()
export class ClanModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  inviteCode!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => Int)
  experience!: number;

  @Field(() => Int)
  experienceIntoLevel!: number;

  @Field(() => Int)
  experienceForNextLevel!: number;

  @Field(() => Int)
  version!: number;

  @Field(() => Int)
  characterVersion!: number;

  @Field(() => ClanRole)
  viewerRole!: ClanRole;

  @Field(() => [ClanMemberModel])
  members!: ClanMemberModel[];

  @Field(() => [ClanResourceModel])
  treasury!: ClanResourceModel[];

  @Field(() => [ClanDevelopmentModel])
  developments!: ClanDevelopmentModel[];
}

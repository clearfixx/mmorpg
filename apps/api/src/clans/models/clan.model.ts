import { ClanRole } from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ClanRole, { name: 'ClanRole' });

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
  version!: number;

  @Field(() => Int)
  characterVersion!: number;

  @Field(() => ClanRole)
  viewerRole!: ClanRole;

  @Field(() => [ClanMemberModel])
  members!: ClanMemberModel[];
}

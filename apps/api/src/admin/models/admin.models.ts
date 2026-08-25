import { ResourceType, UserRole } from '@veilfall/database';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminResourceModel {
  @Field(() => ResourceType)
  type!: ResourceType;

  @Field(() => Int)
  amount!: number;
}

@ObjectType()
export class AdminCharacterModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => UserRole)
  userRole!: UserRole;

  @Field(() => Int)
  level!: number;

  @Field(() => Int)
  experience!: number;

  @Field(() => Int)
  gold!: number;

  @Field(() => Int)
  version!: number;

  @Field(() => [AdminResourceModel])
  resources!: AdminResourceModel[];
}

@ObjectType()
export class AdminMutationResultModel {
  @Field(() => ID)
  auditId!: string;

  @Field(() => AdminCharacterModel)
  character!: AdminCharacterModel;
}

@ObjectType()
export class AdminAuditLogModel {
  @Field(() => ID)
  id!: string;

  @Field()
  actorEmail!: string;

  @Field()
  action!: string;

  @Field()
  targetType!: string;

  @Field()
  targetId!: string;

  @Field()
  reason!: string;

  @Field()
  createdAt!: Date;
}

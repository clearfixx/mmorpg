import { ResourceType } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(ResourceType, { name: 'ResourceType' });

@ObjectType()
export class ResourceBalanceModel {
  @Field(() => ResourceType)
  type!: ResourceType;

  @Field(() => Int)
  amount!: number;
}

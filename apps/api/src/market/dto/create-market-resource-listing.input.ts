import { ResourceType } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';

@InputType()
export class CreateMarketResourceListingInput {
  @Field(() => ResourceType)
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(10_000)
  amount!: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  price!: number;

  @Field()
  @IsUUID()
  idempotencyKey!: string;
}

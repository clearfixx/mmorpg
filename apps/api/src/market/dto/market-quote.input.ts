import { ResourceType } from '@veilfall/database';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

@InputType()
export class MarketQuoteInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @Field(() => ResourceType, { nullable: true })
  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  amount?: number;
}

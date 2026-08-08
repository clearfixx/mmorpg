import { ResourceType } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Max, Min } from 'class-validator';

@InputType()
export class ContributeClanResourceInput {
  @Field(() => ResourceType)
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(100000)
  amount!: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedCharacterVersion!: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedClanVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

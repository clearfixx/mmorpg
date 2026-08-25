import { ResourceType } from '@veilfall/database';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsUUID, Length, Max, Min } from 'class-validator';

@InputType()
export class AdjustCharacterResourceInput {
  @Field(() => ID)
  @IsUUID()
  characterId!: string;

  @Field(() => ResourceType)
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @Field(() => Int)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  delta!: number;

  @Field()
  @Length(5, 500)
  reason!: string;

  @Field()
  @Length(8, 64)
  idempotencyKey!: string;
}

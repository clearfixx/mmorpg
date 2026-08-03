import { WorldLocation } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class TravelInput {
  @Field(() => WorldLocation)
  @IsEnum(WorldLocation)
  destination!: WorldLocation;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

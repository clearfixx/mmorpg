import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class SummonClanBossInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedClanVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

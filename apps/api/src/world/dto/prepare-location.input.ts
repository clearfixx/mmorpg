import { PreparationChoice } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class PrepareLocationInput {
  @Field(() => PreparationChoice)
  @IsEnum(PreparationChoice)
  choice!: PreparationChoice;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

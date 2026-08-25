import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

@InputType()
export class StartTemperingInput {
  @Field(() => ID) @IsString() itemId!: string;
  @Field(() => Int) @IsInt() @Min(0) @Max(35) accelerationPercent!: number;
  @Field(() => Int) @IsInt() @Min(1) expectedCharacterVersion!: number;
  @Field(() => Int) @IsInt() @Min(1) expectedItemVersion!: number;
  @Field() @IsString() @MinLength(8) idempotencyKey!: string;
}

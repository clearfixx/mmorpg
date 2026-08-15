import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

@InputType()
export class ResolveTemperingInput {
  @Field(() => ID) @IsString() processId!: string;
  @Field(() => Int) @IsInt() @Min(1) expectedCharacterVersion!: number;
  @Field(() => Int) @IsInt() @Min(1) expectedItemVersion!: number;
  @Field() @IsString() @MinLength(8) idempotencyKey!: string;
}

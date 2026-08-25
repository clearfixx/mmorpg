import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

@InputType()
export class StartCraftInput {
  @Field() @IsString() @Length(1, 64) recipeId!: string;
  @Field(() => Int) @IsInt() @Min(1) @Max(100) quantity!: number;
  @Field() @IsString() @Length(8, 64) idempotencyKey!: string;
}

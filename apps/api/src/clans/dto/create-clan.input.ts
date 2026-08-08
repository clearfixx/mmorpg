import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Matches, Min } from 'class-validator';

@InputType()
export class CreateClanInput {
  @Field()
  @IsString()
  @Length(3, 32)
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N} '&-]{1,30}[\p{L}\p{N}]$/u)
  name!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedCharacterVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

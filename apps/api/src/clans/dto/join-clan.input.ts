import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Matches, Min } from 'class-validator';

@InputType()
export class JoinClanInput {
  @Field()
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-F0-9]{8}$/)
  inviteCode!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedCharacterVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

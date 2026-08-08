import { ClanDevelopmentBranch } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class UpgradeClanDevelopmentInput {
  @Field(() => ClanDevelopmentBranch)
  @IsEnum(ClanDevelopmentBranch)
  branch!: ClanDevelopmentBranch;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedClanVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

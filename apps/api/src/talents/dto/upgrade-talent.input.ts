import { TalentType } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class UpgradeTalentInput {
  @Field(() => TalentType)
  @IsEnum(TalentType)
  type!: TalentType;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedCharacterVersion!: number;

  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

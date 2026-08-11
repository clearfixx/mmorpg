import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

const ACTION_IDS = [
  'STRIKE',
  'GUARD',
  'SHIELD_BASH',
  'SECOND_WIND',
  'QUICK_SHOT',
  'EVADE',
  'BARBED_ARROW',
  'FOCUSED_SHOT',
  'ARCANE_BOLT',
  'WARD',
  'DISRUPTING_SPARK',
  'VEIL_FLARE',
];

@InputType()
export class SubmitCombatCommandInput {
  @Field()
  @IsString()
  @IsIn(ACTION_IDS)
  actionId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  targetEnemyId?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

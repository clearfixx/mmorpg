import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsUUID, Length, Max, Min } from 'class-validator';

@InputType()
export class SetCharacterLevelInput {
  @Field(() => ID)
  @IsUUID()
  characterId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(99)
  level!: number;

  @Field()
  @Length(5, 500)
  reason!: string;

  @Field()
  @Length(8, 64)
  idempotencyKey!: string;
}

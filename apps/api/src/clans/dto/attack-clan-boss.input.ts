import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, IsUUID, Length, Min } from 'class-validator';

@InputType()
export class AttackClanBossInput {
  @Field(() => ID)
  @IsUUID()
  encounterId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(8, 64)
  idempotencyKey!: string;
}

import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID, Length } from 'class-validator';

@InputType()
export class ClaimClanBossRewardInput {
  @Field(() => ID)
  @IsUUID()
  encounterId!: string;

  @Field()
  @Length(8, 64)
  idempotencyKey!: string;
}

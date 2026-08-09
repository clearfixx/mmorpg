import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, Length } from 'class-validator';

@InputType()
export class ClaimCraftInput {
  @Field(() => ID) @IsUUID() craftJobId!: string;
  @Field() @IsString() @Length(8, 64) idempotencyKey!: string;
}

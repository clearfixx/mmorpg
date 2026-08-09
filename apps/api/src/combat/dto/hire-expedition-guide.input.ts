import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

@InputType()
export class HireExpeditionGuideInput {
  @Field(() => Int) @IsInt() @Min(2) @Max(500) checkpointTier!: number;
  @Field() @IsString() @Length(16, 64) idempotencyKey!: string;
}

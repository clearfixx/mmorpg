import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, Length } from 'class-validator';

@InputType()
export class ContinueAdventureInput {
  @Field(() => ID) @IsUUID() battleId!: string;
  @Field() @IsString() @Length(16, 64) idempotencyKey!: string;
}

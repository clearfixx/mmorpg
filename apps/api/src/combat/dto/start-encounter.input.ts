import { Field, InputType } from '@nestjs/graphql';
import { IsString, Length } from 'class-validator';

@InputType()
export class StartEncounterInput {
  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

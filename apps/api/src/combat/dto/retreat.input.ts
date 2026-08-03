import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class RetreatInput {
  @Field(() => Int)
  @IsInt()
  @Min(2)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(16, 64)
  idempotencyKey!: string;
}

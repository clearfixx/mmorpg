import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, Length, MaxLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field()
  @Length(12, 128)
  password!: string;
}

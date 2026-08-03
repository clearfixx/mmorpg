import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, Length, MaxLength } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field()
  @Length(1, 128)
  password!: string;
}

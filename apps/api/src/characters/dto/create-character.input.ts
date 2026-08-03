import {
  AvatarMode,
  CharacterArchetype,
  CharacterOrigin,
} from '@veilfall/database';
import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateCharacterInput {
  @Field()
  @IsString()
  @Length(3, 24)
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N} '-]{1,22}[\p{L}\p{N}]$/u)
  name!: string;

  @Field(() => CharacterArchetype)
  @IsEnum(CharacterArchetype)
  archetype!: CharacterArchetype;

  @Field(() => CharacterOrigin, { nullable: true })
  @IsOptional()
  @IsEnum(CharacterOrigin)
  origin?: CharacterOrigin;

  @Field(() => AvatarMode)
  @IsEnum(AvatarMode)
  avatarMode!: AvatarMode;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  staticAvatarId?: string;
}

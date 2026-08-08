import {
  AvatarMode,
  CharacterArchetype,
  CharacterOrigin,
} from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { CharacterStats } from './character-stats.model';

registerEnumType(CharacterArchetype, { name: 'CharacterArchetype' });
registerEnumType(CharacterOrigin, { name: 'CharacterOrigin' });
registerEnumType(AvatarMode, { name: 'AvatarMode' });

@ObjectType()
export class CharacterModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => CharacterArchetype)
  archetype!: CharacterArchetype;

  @Field(() => CharacterOrigin)
  origin!: CharacterOrigin;

  @Field(() => AvatarMode)
  avatarMode!: AvatarMode;

  @Field(() => String, { nullable: true })
  staticAvatarId!: string | null;

  @Field(() => Int)
  level!: number;

  @Field(() => Int)
  experience!: number;

  @Field(() => Int)
  experienceIntoLevel!: number;

  @Field(() => Int)
  experienceForNextLevel!: number;

  @Field(() => Int)
  gold!: number;

  @Field(() => Int)
  version!: number;

  @Field(() => CharacterStats)
  baseStats!: CharacterStats;

  @Field()
  createdAt!: Date;
}

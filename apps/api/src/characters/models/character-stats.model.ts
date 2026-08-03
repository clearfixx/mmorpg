import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CharacterStats {
  @Field(() => Int)
  health!: number;

  @Field(() => Int)
  damage!: number;

  @Field(() => Int)
  armor!: number;

  @Field(() => Int)
  speed!: number;

  @Field(() => Int)
  reaction!: number;
}

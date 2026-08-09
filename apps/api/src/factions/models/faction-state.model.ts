import { WorldFaction } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(WorldFaction, { name: 'WorldFaction' });

@ObjectType()
export class FactionStateModel {
  @Field(() => WorldFaction, { nullable: true })
  faction!: WorldFaction | null;

  @Field(() => Int)
  characterVersion!: number;

  @Field()
  canChangeFaction!: boolean;

  @Field(() => Int)
  dawnStrength!: number;

  @Field(() => Int)
  ashenStrength!: number;

  @Field()
  contestedLocation!: string;

  @Field(() => WorldFaction)
  controllingFaction!: WorldFaction;

  @Field(() => Int)
  frontLevelMin!: number;

  @Field(() => Int)
  frontLevelMax!: number;

  @Field()
  nextScriptedShiftAt!: Date;
}

import { PreparationChoice, WorldLocation } from '@veilfall/database';
import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(WorldLocation, { name: 'WorldLocation' });
registerEnumType(PreparationChoice, { name: 'PreparationChoice' });

@ObjectType()
export class WorldRouteModel {
  @Field(() => WorldLocation)
  destination!: WorldLocation;

  @Field()
  locked!: boolean;

  @Field(() => String, { nullable: true })
  lockReason!: string | null;
}

@ObjectType()
export class WorldStateModel {
  @Field(() => WorldLocation)
  currentLocation!: WorldLocation;

  @Field(() => PreparationChoice, { nullable: true })
  preparationChoice!: PreparationChoice | null;

  @Field(() => Int)
  version!: number;

  @Field(() => Int)
  highestClearedTier!: number;

  @Field(() => Int)
  cinderhavenUnlockTier!: number;

  @Field()
  cinderhavenUnlocked!: boolean;

  @Field(() => [WatchpostVoiceModel])
  watchpostVoices!: WatchpostVoiceModel[];

  @Field(() => [WorldRouteModel])
  routes!: WorldRouteModel[];
}

@ObjectType()
export class WatchpostVoiceModel {
  @Field() id!: string;
  @Field() name!: string;
  @Field() role!: string;
  @Field() line!: string;
}

@ObjectType()
export class WorldMapNodeModel {
  @Field() id!: string;
  @Field() name!: string;
  @Field() kind!: string;
  @Field() status!: string;
  @Field(() => Int, { nullable: true }) stages!: number | null;
  @Field(() => String, { nullable: true }) note!: string | null;
}

@ObjectType()
export class WorldMapModel {
  @Field(() => [WorldMapNodeModel]) nodes!: WorldMapNodeModel[];
}

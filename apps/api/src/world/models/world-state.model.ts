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

  @Field(() => [WorldRouteModel])
  routes!: WorldRouteModel[];
}

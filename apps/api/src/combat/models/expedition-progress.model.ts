import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ExpeditionProgressModel {
  @Field(() => Int) highestClearedTier!: number;
  @Field(() => Int) checkpointTier!: number;
  @Field(() => Int, { nullable: true }) saveableTier!: number | null;
  @Field(() => Int, { nullable: true }) saveCost!: number | null;
  @Field(() => Int) gold!: number;
  @Field(() => Boolean) canAffordSave!: boolean;
}

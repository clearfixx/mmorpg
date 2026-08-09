import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ExpeditionProgressModel {
  @Field(() => Int) highestClearedTier!: number;
  @Field(() => Int) checkpointTier!: number;
  @Field(() => Int) nextCheckpointTier!: number;
  @Field(() => Int) nextCheckpointCost!: number;
  @Field(() => Int) gold!: number;
  @Field(() => Boolean) canAffordNextCheckpoint!: boolean;
}

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TemperingCostModel {
  @Field() key!: string;
  @Field(() => Int) required!: number;
  @Field(() => Int) available!: number;
  @Field() sufficient!: boolean;
}

@ObjectType()
export class TemperingStatsModel {
  @Field(() => Int) currentDamage!: number;
  @Field(() => Int) nextDamage!: number;
  @Field(() => Int) damageDelta!: number;
  @Field(() => Int) currentArmor!: number;
  @Field(() => Int) nextArmor!: number;
  @Field(() => Int) armorDelta!: number;
  @Field(() => Int) currentHealth!: number;
  @Field(() => Int) nextHealth!: number;
  @Field(() => Int) healthDelta!: number;
}

@ObjectType()
export class TemperingPreviewModel {
  @Field(() => ID) itemId!: string;
  @Field() itemName!: string;
  @Field(() => Int) itemVersion!: number;
  @Field(() => Int) currentStage!: number;
  @Field() currentStageName!: string;
  @Field(() => Int, { nullable: true }) targetStage!: number | null;
  @Field(() => String, { nullable: true }) targetStageName!: string | null;
  @Field() ritualMilestone!: string;
  @Field(() => Int) progressBasisPoints!: number;
  @Field(() => Int) successChanceBasisPoints!: number;
  @Field() guaranteed!: boolean;
  @Field() eligible!: boolean;
  @Field() affordable!: boolean;
  @Field(() => Int) durationSeconds!: number;
  @Field(() => Int) accelerationPercent!: number;
  @Field(() => [String]) blockingReasons!: string[];
  @Field(() => [String]) warnings!: string[];
  @Field(() => [TemperingCostModel]) costs!: TemperingCostModel[];
  @Field(() => TemperingStatsModel) stats!: TemperingStatsModel;
}

@ObjectType()
export class TemperingJobModel {
  @Field(() => ID) id!: string;
  @Field(() => ID) itemId!: string;
  @Field(() => Int) itemVersion!: number;
  @Field() itemName!: string;
  @Field(() => Int) startingStage!: number;
  @Field(() => Int) targetStage!: number;
  @Field() targetStageName!: string;
  @Field() ritualMilestone!: string;
  @Field() status!: string;
  @Field() startedAt!: Date;
  @Field() readyAt!: Date;
  @Field(() => Int) remainingSeconds!: number;
  @Field(() => Int) accelerationPercent!: number;
  @Field() canComplete!: boolean;
  @Field() canCancel!: boolean;
  @Field(() => Int) progressPercent!: number;
  @Field(() => [TemperingCostModel]) cancellationRefunds!: TemperingCostModel[];
  @Field(() => [TemperingCostModel]) cancellationLosses!: TemperingCostModel[];
}

@ObjectType()
export class TemperingHistoryModel {
  @Field(() => ID) id!: string;
  @Field(() => ID) itemId!: string;
  @Field() itemName!: string;
  @Field(() => Int) startingStage!: number;
  @Field(() => Int) targetStage!: number;
  @Field() status!: string;
  @Field(() => Int, { nullable: true }) resultProgress!: number | null;
  @Field(() => Boolean, { nullable: true }) guaranteed!: boolean | null;
  @Field(() => Date) startedAt!: Date;
  @Field(() => Date, { nullable: true }) resolvedAt!: Date | null;
}

@ObjectType()
export class TemperingRoadmapStageModel {
  @Field(() => Int) stage!: number;
  @Field(() => Int) successChanceBasisPoints!: number;
  @Field(() => Int) expectedAttempts!: number;
  @Field(() => Int) maximumAttempts!: number;
  @Field(() => Int) expectedDurationSeconds!: number;
}

@ObjectType()
export class TemperingRoadmapModel {
  @Field(() => Int) fromStage!: number;
  @Field(() => Int) toStage!: number;
  @Field(() => Int) expectedAttempts!: number;
  @Field(() => Int) maximumAttempts!: number;
  @Field(() => Int) expectedDurationSeconds!: number;
  @Field(() => Int) maximumDurationSeconds!: number;
  @Field(() => [TemperingCostModel]) expectedCosts!: TemperingCostModel[];
  @Field(() => [TemperingRoadmapStageModel])
  stages!: TemperingRoadmapStageModel[];
}

@ObjectType()
export class TemperingInvestmentModel {
  @Field(() => Int) completedAttempts!: number;
  @Field(() => Int) successfulAttempts!: number;
  @Field(() => Int) progressAttempts!: number;
  @Field(() => Int) cancelledAttempts!: number;
  @Field(() => Int) goldSpent!: number;
}

@ObjectType()
export class TemperingStateModel {
  @Field(() => Int) characterVersion!: number;
  @Field(() => Int) queueCapacity!: number;
  @Field(() => Int) queueAvailable!: number;
  @Field(() => [TemperingJobModel]) jobs!: TemperingJobModel[];
  @Field(() => [TemperingHistoryModel]) history!: TemperingHistoryModel[];
  @Field(() => TemperingRoadmapModel, { nullable: true })
  roadmap!: TemperingRoadmapModel | null;
  @Field(() => TemperingInvestmentModel) investment!: TemperingInvestmentModel;
  @Field(() => TemperingPreviewModel, { nullable: true })
  preview!: TemperingPreviewModel | null;
}

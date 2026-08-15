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
  @Field(() => Int, { nullable: true }) targetStage!: number | null;
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
  @Field(() => Int) targetStage!: number;
  @Field() status!: string;
  @Field() startedAt!: Date;
  @Field() readyAt!: Date;
  @Field(() => Int) remainingSeconds!: number;
  @Field(() => Int) accelerationPercent!: number;
  @Field() canComplete!: boolean;
  @Field() canCancel!: boolean;
}

@ObjectType()
export class TemperingStateModel {
  @Field(() => Int) characterVersion!: number;
  @Field(() => Int) queueCapacity!: number;
  @Field(() => Int) queueAvailable!: number;
  @Field(() => [TemperingJobModel]) jobs!: TemperingJobModel[];
  @Field(() => TemperingPreviewModel, { nullable: true })
  preview!: TemperingPreviewModel | null;
}

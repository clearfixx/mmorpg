import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CombatantModel {
  @Field(() => Int) health!: number;
  @Field(() => Int) maxHealth!: number;
  @Field(() => Int, { nullable: true }) resource?: number;
  @Field(() => Int, { nullable: true }) maxResource?: number;
}

@ObjectType()
export class CombatActionModel {
  @Field() id!: string;
  @Field() name!: string;
  @Field(() => Int) cost!: number;
  @Field() description!: string;
}

@ObjectType()
export class EnemyIntentModel {
  @Field() id!: string;
  @Field() name!: string;
  @Field() description!: string;
}

@ObjectType()
export class CombatLogEntryModel {
  @Field(() => Int) turn!: number;
  @Field() kind!: string;
  @Field() message!: string;
  @Field(() => Int, { nullable: true }) amount?: number;
  @Field(() => String, { nullable: true }) detail?: string;
}

@ObjectType()
export class BattleModel {
  @Field(() => ID) id!: string;
  @Field() status!: string;
  @Field() phase!: string;
  @Field(() => Int) encounterTier!: number;
  @Field(() => Boolean) personalBest!: boolean;
  @Field() enemyName!: string;
  @Field(() => Int) version!: number;
  @Field(() => Int) turn!: number;
  @Field(() => CombatantModel) hero!: CombatantModel;
  @Field(() => CombatantModel) enemy!: CombatantModel;
  @Field(() => EnemyIntentModel) currentIntent!: EnemyIntentModel;
  @Field(() => [EnemyIntentModel]) visibleIntents!: EnemyIntentModel[];
  @Field(() => [CombatActionModel]) actions!: CombatActionModel[];
  @Field(() => [CombatLogEntryModel]) log!: CombatLogEntryModel[];
}

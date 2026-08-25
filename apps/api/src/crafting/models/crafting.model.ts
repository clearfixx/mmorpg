import {
  CraftingStation,
  CraftJobStatus,
  ResourceType,
} from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(CraftingStation, { name: 'CraftingStation' });
registerEnumType(CraftJobStatus, { name: 'CraftJobStatus' });

@ObjectType()
export class RecipeIngredientModel {
  @Field(() => ResourceType) resourceType!: ResourceType;
  @Field() name!: string;
  @Field(() => Int) amount!: number;
  @Field(() => Int) available!: number;
}

@ObjectType()
export class CraftingRecipeModel {
  @Field() id!: string;
  @Field() name!: string;
  @Field() description!: string;
  @Field(() => CraftingStation) station!: CraftingStation;
  @Field(() => Int) durationSeconds!: number;
  @Field(() => [RecipeIngredientModel]) ingredients!: RecipeIngredientModel[];
  @Field(() => ResourceType) outputType!: ResourceType;
  @Field() outputName!: string;
  @Field(() => Int) outputAmount!: number;
  @Field() affordable!: boolean;
  @Field() stationAvailable!: boolean;
  @Field() discovered!: boolean;
}

@ObjectType()
export class CraftJobModel {
  @Field(() => ID) id!: string;
  @Field() recipeId!: string;
  @Field() recipeName!: string;
  @Field(() => CraftingStation) station!: CraftingStation;
  @Field(() => CraftJobStatus) status!: CraftJobStatus;
  @Field(() => Int) quantity!: number;
  @Field(() => ResourceType) outputType!: ResourceType;
  @Field() outputName!: string;
  @Field(() => Int) outputAmount!: number;
  @Field() startedAt!: Date;
  @Field() completesAt!: Date;
  @Field(() => Int) remainingSeconds!: number;
  @Field() ready!: boolean;
}

@ObjectType()
export class CraftingStateModel {
  @Field(() => [CraftingRecipeModel]) recipes!: CraftingRecipeModel[];
  @Field(() => [CraftJobModel]) jobs!: CraftJobModel[];
}

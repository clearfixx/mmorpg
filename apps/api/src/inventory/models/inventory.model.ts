import { EquipmentSlot } from '@veilfall/database';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(EquipmentSlot, { name: 'EquipmentSlot' });

@ObjectType()
export class InventoryItemModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() definitionId!: string;
  @Field(() => Int) itemLevel!: number;
  @Field() rarity!: string;
  @Field(() => Int) rollQuality!: number;
  @Field(() => Int) damage!: number;
  @Field(() => Int) armor!: number;
  @Field(() => Int) health!: number;
  @Field(() => Int) damageMin!: number;
  @Field(() => Int) damageMax!: number;
  @Field(() => [EquipmentSlot]) compatibleSlots!: EquipmentSlot[];
  @Field() binding!: string;
  @Field() setName!: string;
  @Field() visualAssetId!: string;
}

@ObjectType()
export class EquippedItemModel {
  @Field(() => EquipmentSlot) slot!: EquipmentSlot;
  @Field(() => InventoryItemModel) item!: InventoryItemModel;
}

@ObjectType()
export class InventoryModel {
  @Field(() => Int) characterVersion!: number;
  @Field(() => Int) baseDamage!: number;
  @Field(() => Int) totalDamage!: number;
  @Field(() => Int) baseArmor!: number;
  @Field(() => Int) totalArmor!: number;
  @Field(() => Int) baseHealth!: number;
  @Field(() => Int) totalHealth!: number;
  @Field(() => [InventoryItemModel]) chest!: InventoryItemModel[];
  @Field(() => [InventoryItemModel]) backpack!: InventoryItemModel[];
  @Field(() => [EquippedItemModel]) equipped!: EquippedItemModel[];
  @Field(() => String, { nullable: true }) mainHandVisualAssetId!:
    string | null;
}

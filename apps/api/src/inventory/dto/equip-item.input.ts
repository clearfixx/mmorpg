import { EquipmentSlot } from '@veilfall/database';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, IsUUID, Length, Min } from 'class-validator';

@InputType()
export class EquipItemInput {
  @Field(() => ID) @IsUUID() itemId!: string;
  @Field(() => EquipmentSlot) @IsEnum(EquipmentSlot) slot!: EquipmentSlot;
  @Field(() => Int) @IsInt() @Min(1) expectedCharacterVersion!: number;
  @Field() @IsString() @Length(16, 64) idempotencyKey!: string;
}

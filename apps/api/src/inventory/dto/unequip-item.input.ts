import { EquipmentSlot } from '@veilfall/database';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';

@InputType()
export class UnequipItemInput {
  @Field(() => EquipmentSlot) @IsEnum(EquipmentSlot) slot!: EquipmentSlot;
  @Field(() => Int) @IsInt() @Min(1) expectedCharacterVersion!: number;
  @Field() @IsString() @Length(16, 64) idempotencyKey!: string;
}

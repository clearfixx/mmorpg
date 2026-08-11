import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MARKET_KINDS = ['ALL', 'EQUIPMENT', 'RESOURCE'] as const;
export const MARKET_SORTS = [
  'NEWEST',
  'ENDING',
  'PRICE_ASC',
  'PRICE_DESC',
] as const;

export type MarketKind = (typeof MARKET_KINDS)[number];
export type MarketSort = (typeof MARKET_SORTS)[number];

@InputType()
export class MarketBrowseInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(MARKET_KINDS)
  kind?: MarketKind;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(MARKET_SORTS)
  sort?: MarketSort;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;
}

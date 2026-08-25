import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class MarketListingCommandInput {
  @Field(() => ID)
  @IsUUID()
  listingId!: string;

  @Field()
  @IsUUID()
  idempotencyKey!: string;
}

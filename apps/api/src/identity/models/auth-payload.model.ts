import { Field, ObjectType } from '@nestjs/graphql';

import { Viewer } from './viewer.model';

@ObjectType()
export class AuthPayload {
  @Field()
  authenticated!: boolean;

  @Field(() => Viewer, { nullable: true })
  viewer!: Viewer | null;
}

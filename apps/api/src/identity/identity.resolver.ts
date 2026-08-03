import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import type { GraphqlContext } from './identity.types';
import { IdentityService } from './identity.service';
import { AuthPayload } from './models/auth-payload.model';
import { Viewer } from './models/viewer.model';
import { SessionService } from './session.service';

@Resolver()
export class IdentityResolver {
  constructor(
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => Viewer, { nullable: true })
  viewer(@Context() context: GraphqlContext): Promise<Viewer | null> {
    return this.sessions.viewer(context.req);
  }

  @Mutation(() => AuthPayload)
  async register(
    @Args('input') input: RegisterInput,
    @Context() context: GraphqlContext,
  ): Promise<AuthPayload> {
    const viewer = await this.identity.register(
      input.email,
      input.password,
      context.res,
    );
    return { authenticated: true, viewer };
  }

  @Mutation(() => AuthPayload)
  async login(
    @Args('input') input: LoginInput,
    @Context() context: GraphqlContext,
  ): Promise<AuthPayload> {
    const viewer = await this.identity.login(
      input.email,
      input.password,
      context.res,
    );
    return { authenticated: true, viewer };
  }

  @Mutation(() => Boolean)
  async logout(@Context() context: GraphqlContext): Promise<boolean> {
    await this.sessions.end(context.req, context.res);
    return true;
  }
}

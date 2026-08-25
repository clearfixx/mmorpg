import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { GraphqlContext } from '../identity/identity.types';
import { AdminAccessService } from './admin-access.service';
import { AdminService } from './admin.service';
import { AdjustCharacterResourceInput } from './dto/adjust-character-resource.input';
import { SetCharacterLevelInput } from './dto/set-character-level.input';
import {
  AdminAuditLogModel,
  AdminCharacterModel,
  AdminMutationResultModel,
} from './models/admin.models';

@Resolver()
export class AdminResolver {
  constructor(
    private readonly admin: AdminService,
    private readonly access: AdminAccessService,
  ) {}

  @Query(() => [AdminCharacterModel])
  async adminCharacters(
    @Context() context: GraphqlContext,
    @Args('search', { nullable: true, defaultValue: '' }) search: string,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 50 })
    take: number,
  ) {
    await this.access.requireRead(context.req);
    return this.admin.characters(search, take);
  }

  @Query(() => [AdminAuditLogModel])
  async adminAuditLogs(
    @Context() context: GraphqlContext,
    @Args('targetId', { type: () => String, nullable: true })
    targetId: string | undefined,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 50 })
    take: number,
  ) {
    await this.access.requireRead(context.req);
    return this.admin.auditLogs(targetId, take);
  }

  @Mutation(() => AdminMutationResultModel)
  async adminAdjustCharacterResource(
    @Args('input') input: AdjustCharacterResourceInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.access.requireWrite(context.req);
    return this.admin.adjustResource(viewer.id, input);
  }

  @Mutation(() => AdminMutationResultModel)
  async adminSetCharacterLevel(
    @Args('input') input: SetCharacterLevelInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.access.requireWrite(context.req);
    return this.admin.setLevel(viewer.id, input);
  }
}

import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { EquipItemInput } from './dto/equip-item.input';
import { InventoryModel } from './models/inventory.model';
import { InventoryService } from './inventory.service';

@Resolver(() => InventoryModel)
export class InventoryResolver {
  constructor(
    private readonly inventory: InventoryService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => InventoryModel)
  async myInventory(@Context() context: GraphqlContext) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.inventory.forUser(viewer.id);
  }

  @Mutation(() => InventoryModel)
  async equipItem(
    @Args('input') input: EquipItemInput,
    @Context() context: GraphqlContext,
  ) {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.inventory.equip(viewer.id, input);
  }
}

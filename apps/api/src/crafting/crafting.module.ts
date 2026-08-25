import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { CraftingResolver } from './crafting.resolver';
import { CraftingService } from './crafting.service';

@Module({
  imports: [DatabaseModule, IdentityModule, CharactersModule],
  providers: [CraftingResolver, CraftingService],
})
export class CraftingModule {}

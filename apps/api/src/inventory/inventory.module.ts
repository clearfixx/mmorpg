import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [InventoryResolver, InventoryService],
})
export class InventoryModule {}

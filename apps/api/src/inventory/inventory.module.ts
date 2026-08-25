import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';
import { TemperingResolver } from '../tempering/tempering.resolver';
import { TemperingService } from '../tempering/tempering.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [
    InventoryResolver,
    InventoryService,
    TemperingResolver,
    TemperingService,
  ],
})
export class InventoryModule {}

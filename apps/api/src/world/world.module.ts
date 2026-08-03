import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { WorldResolver } from './world.resolver';
import { WorldService } from './world.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [WorldResolver, WorldService],
})
export class WorldModule {}

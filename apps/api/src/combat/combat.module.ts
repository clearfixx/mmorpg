import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { WorldModule } from '../world/world.module';
import { CombatResolver } from './combat.resolver';
import { CombatService } from './combat.service';

@Module({
  imports: [CharactersModule, IdentityModule, WorldModule],
  providers: [CombatResolver, CombatService],
})
export class CombatModule {}

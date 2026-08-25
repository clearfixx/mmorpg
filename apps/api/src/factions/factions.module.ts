import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { FactionsResolver } from './factions.resolver';
import { FactionsService } from './factions.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [FactionsResolver, FactionsService],
})
export class FactionsModule {}

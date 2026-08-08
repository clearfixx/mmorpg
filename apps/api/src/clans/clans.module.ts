import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { ClansResolver } from './clans.resolver';
import { ClansService } from './clans.service';
import { ClanBossesResolver } from './clan-bosses.resolver';
import { ClanBossesService } from './clan-bosses.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [
    ClanBossesResolver,
    ClanBossesService,
    ClansResolver,
    ClansService,
  ],
})
export class ClansModule {}

import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { ClansResolver } from './clans.resolver';
import { ClansService } from './clans.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [ClansResolver, ClansService],
})
export class ClansModule {}

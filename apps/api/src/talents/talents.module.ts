import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { TalentsResolver } from './talents.resolver';
import { TalentsService } from './talents.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [TalentsResolver, TalentsService],
})
export class TalentsModule {}

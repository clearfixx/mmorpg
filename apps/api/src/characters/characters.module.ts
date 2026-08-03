import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import { CharacterNameService } from './character-name.service';
import { CharactersResolver } from './characters.resolver';
import { CharactersService } from './characters.service';

@Module({
  imports: [IdentityModule],
  providers: [CharacterNameService, CharactersResolver, CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}

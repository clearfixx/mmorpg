import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { ResourcesResolver } from './resources.resolver';
import { ResourcesService } from './resources.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [ResourcesResolver, ResourcesService],
})
export class ResourcesModule {}

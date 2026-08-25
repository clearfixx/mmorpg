import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { MarketResolver } from './market.resolver';
import { MarketService } from './market.service';

@Module({
  imports: [DatabaseModule, CharactersModule, IdentityModule],
  providers: [MarketService, MarketResolver],
})
export class MarketModule {}

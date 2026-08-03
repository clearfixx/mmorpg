import { Module } from '@nestjs/common';

import { CharactersModule } from '../characters/characters.module';
import { IdentityModule } from '../identity/identity.module';
import { RewardsResolver } from './rewards.resolver';
import { RewardsService } from './rewards.service';

@Module({
  imports: [CharactersModule, IdentityModule],
  providers: [RewardsResolver, RewardsService],
})
export class RewardsModule {}

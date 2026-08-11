import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { AdminModule } from './admin/admin.module';
import { AppResolver } from './app.resolver';
import { CharactersModule } from './characters/characters.module';
import { ClansModule } from './clans/clans.module';
import { CombatModule } from './combat/combat.module';
import { CraftingModule } from './crafting/crafting.module';
import { DatabaseModule } from './database/database.module';
import { FactionsModule } from './factions/factions.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import type { GraphqlContext } from './identity/identity.types';
import { InventoryModule } from './inventory/inventory.module';
import { MarketModule } from './market/market.module';
import { RewardsModule } from './rewards/rewards.module';
import { ResourcesModule } from './resources/resources.module';
import { TalentsModule } from './talents/talents.module';
import { WorldModule } from './world/world.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'generated/schema.graphql'),
      sortSchema: true,
      context: ({ req, res }: GraphqlContext) => ({ req, res }),
    }),
    DatabaseModule,
    AdminModule,
    IdentityModule,
    InventoryModule,
    MarketModule,
    CharactersModule,
    ClansModule,
    CombatModule,
    CraftingModule,
    FactionsModule,
    RewardsModule,
    ResourcesModule,
    TalentsModule,
    WorldModule,
  ],
  controllers: [HealthController],
  providers: [AppResolver],
})
export class AppModule {}

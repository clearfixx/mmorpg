import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { AppResolver } from './app.resolver';
import { CharactersModule } from './characters/characters.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import type { GraphqlContext } from './identity/identity.types';
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
    IdentityModule,
    CharactersModule,
    WorldModule,
  ],
  controllers: [HealthController],
  providers: [AppResolver],
})
export class AppModule {}

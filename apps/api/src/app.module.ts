import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { AppResolver } from './app.resolver';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'generated/schema.graphql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
    }),
  ],
  controllers: [HealthController],
  providers: [AppResolver],
})
export class AppModule {}

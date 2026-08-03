import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  await app.listen(process.env.API_PORT ?? 4000);
}

void bootstrap();

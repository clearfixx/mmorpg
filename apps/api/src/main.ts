import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { requireEnvironment } from './common/environment';

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
  app.enableCors({
    origin: requireEnvironment('WEB_ORIGIN'),
    credentials: true,
  });
  await app.listen(process.env.API_PORT ?? 4000);
}

void bootstrap();

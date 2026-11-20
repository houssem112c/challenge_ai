import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED_REJECTION]', reason instanceof Error ? reason.stack ?? reason.message : reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT_EXCEPTION]', error.stack ?? error.message);
  });
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = configureApp(app);

  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(`API running on http://localhost:${config.port}/api/health`);
  logger.log(`Swagger docs on http://localhost:${config.port}/api/docs`);
}

await bootstrap();

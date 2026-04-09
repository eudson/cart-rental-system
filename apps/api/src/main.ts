import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';

const DEFAULT_PORT = 3000;

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  configureApp(app);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on port ${port}`);
}

if (require.main === module) {
  void bootstrap();
}

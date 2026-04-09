import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFAULT_DATABASE_URL =
  'postgresql://gcr:gcr_password@127.0.0.1:5440/gcr_dev?schema=public';

test('AppModule wires PrismaService into Nest and connects to the dev database', async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prismaService = app.get(PrismaService);
    const rows = await prismaService.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;

    assert.equal(rows[0]?.result, 1);
  } finally {
    await app.close();
  }
});

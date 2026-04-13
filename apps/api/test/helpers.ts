import 'reflect-metadata';

import type { AddressInfo } from 'node:net';

import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const DEFAULT_DATABASE_URL =
  'postgresql://gcr:gcr_password@127.0.0.1:5440/gcr_dev?schema=public';

export const TEST_PASSWORD = 'Password123!';

export interface TestApp {
  app: INestApplication;
  baseUrl: string;
  prisma: PrismaService;
}

export async function setupTestApp(): Promise<TestApp> {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
  process.env['JWT_SECRET'] = 'test-jwt-secret';
  process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';
  process.env['JWT_EXPIRES_IN'] = '15m';
  process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';

  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0);

  const { port } = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/v1`;
  const prisma = app.get(PrismaService);

  return { app, baseUrl, prisma };
}

export async function loginAsStaff(
  baseUrl: string,
  email: string,
  orgSlug: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationSlug: orgSlug }),
  });

  assert.equal(res.status, 200, `Staff login failed for ${email} (status ${res.status})`);
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

export async function loginAsCustomer(
  baseUrl: string,
  email: string,
  orgSlug: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationSlug: orgSlug }),
  });

  assert.equal(res.status, 200, `Customer login failed for ${email} (status ${res.status})`);
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

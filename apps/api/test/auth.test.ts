import 'reflect-metadata';

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import * as bcrypt from 'bcrypt';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFAULT_DATABASE_URL =
  'postgresql://gcr:gcr_password@127.0.0.1:5440/gcr_dev?schema=public';

const TEST_ORG_SLUG = 'test-auth-org-phase2';
const TEST_STAFF_EMAIL = 'staff@test-auth-phase2.com';
const TEST_CUSTOMER_EMAIL = 'customer@test-auth-phase2.com';
const TEST_PASSWORD = 'Password123!';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

before(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
  process.env['JWT_SECRET'] = 'test-jwt-secret';
  process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';
  process.env['JWT_EXPIRES_IN'] = '15m';
  process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';

  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0);

  const { port } = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/v1`;

  prisma = app.get(PrismaService);

  await cleanupTestData(prisma);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const org = await prisma.organization.create({
    data: { name: 'Test Auth Org Phase2', slug: TEST_ORG_SLUG },
  });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Test Staff',
      email: TEST_STAFF_EMAIL,
      passwordHash,
      role: 'staff',
    },
  });

  await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: 'Test Customer',
      email: TEST_CUSTOMER_EMAIL,
      passwordHash,
    },
  });
});

after(async () => {
  await cleanupTestData(prisma);
  await app.close();
});

async function cleanupTestData(p: PrismaService): Promise<void> {
  const org = await p.organization.findUnique({ where: { slug: TEST_ORG_SLUG } });
  if (!org) return;
  await p.user.deleteMany({ where: { organizationId: org.id } });
  await p.customer.deleteMany({ where: { organizationId: org.id } });
  await p.organization.delete({ where: { id: org.id } });
}

// ─── Staff login ──────────────────────────────────────────────────────────────

test('POST /auth/login — valid credentials returns access and refresh tokens', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_STAFF_EMAIL,
      password: TEST_PASSWORD,
      organizationSlug: TEST_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json() as { data: { accessToken: string; refreshToken: string } };
  assert.ok(body.data.accessToken, 'accessToken should be present');
  assert.ok(body.data.refreshToken, 'refreshToken should be present');
});

test('POST /auth/login — wrong password returns 401 with UNAUTHORIZED code', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_STAFF_EMAIL,
      password: 'wrong-password',
      organizationSlug: TEST_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 401);
  const body = await res.json() as { error: { code: string } };
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

test('POST /auth/login — unknown org slug returns 401', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_STAFF_EMAIL,
      password: TEST_PASSWORD,
      organizationSlug: 'does-not-exist',
    }),
  });

  assert.equal(res.status, 401);
});

test('POST /auth/login — missing fields returns 400', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_STAFF_EMAIL }),
  });

  assert.equal(res.status, 400);
});

// ─── Customer login ───────────────────────────────────────────────────────────

test('POST /auth/customer/login — valid credentials returns access and refresh tokens', async () => {
  const res = await fetch(`${baseUrl}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_CUSTOMER_EMAIL,
      password: TEST_PASSWORD,
      organizationSlug: TEST_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json() as { data: { accessToken: string; refreshToken: string } };
  assert.ok(body.data.accessToken);
  assert.ok(body.data.refreshToken);
});

test('POST /auth/customer/login — wrong password returns 401', async () => {
  const res = await fetch(`${baseUrl}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_CUSTOMER_EMAIL,
      password: 'wrong',
      organizationSlug: TEST_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 401);
});

// ─── Refresh ──────────────────────────────────────────────────────────────────

test('POST /auth/refresh — valid refresh token returns new access token', async () => {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_STAFF_EMAIL,
      password: TEST_PASSWORD,
      organizationSlug: TEST_ORG_SLUG,
    }),
  });
  const loginBody = await loginRes.json() as { data: { refreshToken: string } };
  const { refreshToken } = loginBody.data;

  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  assert.equal(res.status, 200);
  const body = await res.json() as { data: { accessToken: string } };
  assert.ok(body.data.accessToken, 'new accessToken should be present');
});

test('POST /auth/refresh — invalid token string returns 401', async () => {
  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'not-a-real-token' }),
  });

  assert.equal(res.status, 401);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

test('POST /auth/logout — valid JWT clears refresh token; subsequent refresh returns 401', async () => {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_STAFF_EMAIL,
      password: TEST_PASSWORD,
      organizationSlug: TEST_ORG_SLUG,
    }),
  });
  const loginBody = await loginRes.json() as { data: { accessToken: string; refreshToken: string } };
  const { accessToken, refreshToken } = loginBody.data;

  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(logoutRes.status, 200);

  // Refresh token should now be invalid because logout cleared the stored hash
  const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(refreshRes.status, 401);
});

test('POST /auth/logout — no JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 401);
});

// ─── Guard behaviour ──────────────────────────────────────────────────────────

test('JwtAuthGuard — malformed token returns 401 with UNAUTHORIZED code', async () => {
  const res = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: 'Bearer malformed.token.here' },
  });
  assert.equal(res.status, 401);
  const body = await res.json() as { error: { code: string } };
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

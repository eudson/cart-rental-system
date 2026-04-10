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

const TEST_PASSWORD = 'Password123!';
const LOGIN_ORG_SLUG = 'test-orgs-phase3-login-org';
const SUPER_ADMIN_EMAIL = 'super-admin@test-orgs-phase3.com';
const STAFF_EMAIL = 'staff@test-orgs-phase3.com';
const ORG_SLUG_PREFIX = 'test-orgs-phase3-';

const TEST_ORGANIZATIONS = [
  { name: 'Alpha Golf Ops', slug: 'test-orgs-phase3-alpha' },
  { name: 'Beta Cart Rentals', slug: 'test-orgs-phase3-beta' },
  { name: 'Gamma Greens', slug: 'test-orgs-phase3-gamma' },
  { name: 'Delta Fairway Carts', slug: 'test-orgs-phase3-delta' },
];

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
  const loginOrg = await prisma.organization.create({
    data: {
      name: 'Login Organization',
      slug: LOGIN_ORG_SLUG,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        organizationId: loginOrg.id,
        name: 'Super Admin User',
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'super_admin',
      },
      {
        organizationId: loginOrg.id,
        name: 'Staff User',
        email: STAFF_EMAIL,
        passwordHash,
        role: 'staff',
      },
    ],
  });

  await prisma.organization.createMany({ data: TEST_ORGANIZATIONS });
});

after(async () => {
  await cleanupTestData(prisma);
  await app.close();
});

async function cleanupTestData(db: PrismaService): Promise<void> {
  const organizations = await db.organization.findMany({
    where: {
      OR: [
        { slug: LOGIN_ORG_SLUG },
        { slug: { startsWith: ORG_SLUG_PREFIX } },
      ],
    },
    select: { id: true },
  });
  if (organizations.length === 0) {
    return;
  }

  const organizationIds = organizations.map((organization) => organization.id);

  await db.payment.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.leaseContract.deleteMany({
    where: { rental: { organizationId: { in: organizationIds } } },
  });
  await db.rental.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.cart.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.cartType.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.customer.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.user.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.location.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
}

interface LoginResponse {
  data: {
    accessToken: string;
  };
}

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      organizationSlug: LOGIN_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as LoginResponse;
  return body.data.accessToken;
}

test('GET /organizations — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/organizations`);
  assert.equal(res.status, 401);
});

test('GET /organizations — non-super_admin role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/organizations`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 403);

  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('GET /organizations — supports pagination with standard meta shape', async () => {
  const superAdminToken = await loginAs(SUPER_ADMIN_EMAIL);

  const res = await fetch(
    `${baseUrl}/organizations?page=1&pageSize=2&search=test-orgs-phase3-`,
    {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    },
  );
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ name: string; slug: string }>;
    meta: {
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        search: string | null;
      };
    };
  };

  assert.equal(body.data.length, 2);
  assert.deepEqual(
    body.data.map((organization) => organization.name),
    ['Alpha Golf Ops', 'Beta Cart Rentals'],
  );
  assert.equal(body.meta.pagination.page, 1);
  assert.equal(body.meta.pagination.pageSize, 2);
  assert.equal(body.meta.pagination.totalItems, 5);
  assert.equal(body.meta.pagination.totalPages, 3);
  assert.equal(body.meta.pagination.search, 'test-orgs-phase3-');
});

test('GET /organizations — supports case-insensitive search with pagination metadata', async () => {
  const superAdminToken = await loginAs(SUPER_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/organizations?page=1&pageSize=10&search=gamma`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ name: string; slug: string }>;
    meta: {
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        search: string | null;
      };
    };
  };

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.name, 'Gamma Greens');
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'gamma');
});

test('GET /organizations — invalid page query value returns 400', async () => {
  const superAdminToken = await loginAs(SUPER_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/organizations?page=0&pageSize=10`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(res.status, 400);

  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

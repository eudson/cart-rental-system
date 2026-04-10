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
const PRIMARY_ORG_SLUG = 'test-cart-types-phase3-primary-org';
const OTHER_ORG_SLUG = 'test-cart-types-phase3-other-org';
const ORG_SLUG_PREFIX = 'test-cart-types-phase3-';

const SUPER_ADMIN_EMAIL = 'super-admin@test-cart-types-phase3.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-cart-types-phase3.com';
const STAFF_EMAIL = 'staff@test-cart-types-phase3.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let primaryOrgId: string;
let otherOrgCartTypeId: string;
let inUseCartTypeId: string;

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
  const primaryOrg = await prisma.organization.create({
    data: { name: 'Primary Cart Types Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Cart Types Org', slug: OTHER_ORG_SLUG },
  });

  await prisma.user.createMany({
    data: [
      {
        organizationId: primaryOrg.id,
        name: 'Super Admin User',
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'super_admin',
      },
      {
        organizationId: primaryOrg.id,
        name: 'Org Admin User',
        email: ORG_ADMIN_EMAIL,
        passwordHash,
        role: 'org_admin',
      },
      {
        organizationId: primaryOrg.id,
        name: 'Staff User',
        email: STAFF_EMAIL,
        passwordHash,
        role: 'staff',
      },
    ],
  });

  const location = await prisma.location.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Cart Types Location',
      timezone: 'UTC',
    },
  });

  await prisma.cartType.createMany({
    data: [
      {
        organizationId: primaryOrg.id,
        name: 'Golf Basic',
        dailyRate: 50,
        monthlyRate: 900,
        seatingCapacity: 2,
      },
      {
        organizationId: primaryOrg.id,
        name: 'Premium Cruiser',
        dailyRate: 80,
        monthlyRate: 1300,
        seatingCapacity: 4,
      },
    ],
  });

  const inUseType = await prisma.cartType.findFirst({
    where: { organizationId: primaryOrg.id, name: 'Premium Cruiser' },
    select: { id: true },
  });
  assert.ok(inUseType?.id);
  inUseCartTypeId = inUseType.id;

  await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: location.id,
      cartTypeId: inUseCartTypeId,
      label: 'IN-USE-CART-1',
      status: 'available',
    },
  });

  const otherType = await prisma.cartType.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Org Hidden Type',
      dailyRate: 70,
      monthlyRate: 1200,
      seatingCapacity: 2,
    },
  });
  otherOrgCartTypeId = otherType.id;
});

after(async () => {
  await cleanupTestData(prisma);
  await app.close();
});

async function cleanupTestData(db: PrismaService): Promise<void> {
  const organizations = await db.organization.findMany({
    where: {
      OR: [
        { slug: PRIMARY_ORG_SLUG },
        { slug: OTHER_ORG_SLUG },
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
  await db.user.updateMany({
    where: { organizationId: { in: organizationIds } },
    data: { locationId: null },
  });
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
      organizationSlug: PRIMARY_ORG_SLUG,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as LoginResponse;
  return body.data.accessToken;
}

test('GET /cart-types — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/cart-types`);
  assert.equal(res.status, 401);
});

test('GET /cart-types — staff can list own org cart types with pagination metadata', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/cart-types?page=1&pageSize=10&search=golf`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; name: string }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.name, 'Golf Basic');
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'golf');
});

test('POST /cart-types — staff role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/cart-types`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Staff Forbidden Type',
      dailyRate: 55,
      monthlyRate: 1000,
      seatingCapacity: 2,
    }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('POST /cart-types — org_admin can create cart type', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/cart-types`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Created Type',
      description: 'Created via API test',
      dailyRate: 95.5,
      monthlyRate: 1800,
      seatingCapacity: 6,
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    data: {
      id: string;
      organizationId: string;
      name: string;
      dailyRate: string;
      monthlyRate: string;
      seatingCapacity: number;
    };
  };
  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.name, 'Created Type');
  assert.equal(body.data.dailyRate, '95.5');
  assert.equal(body.data.monthlyRate, '1800');
  assert.equal(body.data.seatingCapacity, 6);
});

test('GET /cart-types/:id — staff can fetch own org cart type', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const cartType = await prisma.cartType.findFirst({
    where: { organizationId: primaryOrgId, name: 'Golf Basic' },
    select: { id: true },
  });
  assert.ok(cartType?.id);

  const res = await fetch(`${baseUrl}/cart-types/${cartType.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; name: string } };
  assert.equal(body.data.id, cartType.id);
  assert.equal(body.data.name, 'Golf Basic');
});

test('GET /cart-types/:id — cart type from another org returns 404', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/cart-types/${otherOrgCartTypeId}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('PATCH /cart-types/:id — org_admin can update cart type', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const cartType = await prisma.cartType.findFirst({
    where: { organizationId: primaryOrgId, name: 'Golf Basic' },
    select: { id: true },
  });
  assert.ok(cartType?.id);

  const res = await fetch(`${baseUrl}/cart-types/${cartType.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Golf Basic Updated',
      description: 'Updated description',
      dailyRate: 60,
      monthlyRate: 1100,
      seatingCapacity: 3,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: {
      id: string;
      name: string;
      dailyRate: string;
      monthlyRate: string;
      seatingCapacity: number;
    };
  };
  assert.equal(body.data.id, cartType.id);
  assert.equal(body.data.name, 'Golf Basic Updated');
  assert.equal(body.data.dailyRate, '60');
  assert.equal(body.data.monthlyRate, '1100');
  assert.equal(body.data.seatingCapacity, 3);
});

test('DELETE /cart-types/:id — in-use cart type returns CART_TYPE_IN_USE', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/cart-types/${inUseCartTypeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${orgAdminToken}` },
  });

  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'CART_TYPE_IN_USE');
});

test('DELETE /cart-types/:id — org_admin can delete unused cart type', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const created = await prisma.cartType.create({
    data: {
      organizationId: primaryOrgId,
      name: `Delete Type ${Date.now()}`,
      dailyRate: 77,
      monthlyRate: 1400,
      seatingCapacity: 2,
    },
  });

  const res = await fetch(`${baseUrl}/cart-types/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${orgAdminToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string } };
  assert.equal(body.data.id, created.id);
});

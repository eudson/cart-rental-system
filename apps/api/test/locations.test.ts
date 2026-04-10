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
const PRIMARY_ORG_SLUG = 'test-locs-phase3-primary-org';
const OTHER_ORG_SLUG = 'test-locs-phase3-other-org';
const SUPER_ADMIN_EMAIL = 'super-admin@test-locs-phase3.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-locs-phase3.com';
const STAFF_EMAIL = 'staff@test-locs-phase3.com';
const SLUG_PREFIX = 'test-locs-phase3-';

const PRIMARY_LOCATIONS = [
  { name: 'Alpha Depot', address: '12 Fairway Rd', timezone: 'Africa/Johannesburg' },
  { name: 'Beta Yard', address: '88 Caddy Ave', timezone: 'UTC' },
  { name: 'Gamma Storage', address: '44 Green St', timezone: 'America/New_York' },
];

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let primaryOrgId: string;
let otherOrgLocationId: string;

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
    data: { name: 'Primary Locations Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Locations Org', slug: OTHER_ORG_SLUG },
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

  await prisma.location.createMany({
    data: PRIMARY_LOCATIONS.map((location) => ({
      organizationId: primaryOrg.id,
      ...location,
    })),
  });

  const otherOrgLocation = await prisma.location.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Org Hidden Location',
      address: 'No Access Road',
      timezone: 'UTC',
    },
  });
  otherOrgLocationId = otherOrgLocation.id;
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
        { slug: { startsWith: SLUG_PREFIX } },
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

test('GET /locations — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/locations`);
  assert.equal(res.status, 401);
});

test('GET /locations — staff can list own org locations with pagination metadata', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/locations?page=1&pageSize=10&search=depot`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ name: string }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.name, 'Alpha Depot');
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'depot');
});

test('GET /locations — invalid page query value returns 400', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/locations?page=0&pageSize=10`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 400);

  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('POST /locations — staff role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/locations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Staff Forbidden Location',
    }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('POST /locations — org_admin can create location in own org', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/locations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Delta Hub',
      address: '73 Links Way',
      timezone: 'Africa/Johannesburg',
      status: 'active',
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    data: {
      id: string;
      organizationId: string;
      name: string;
      address: string | null;
      timezone: string;
      status: string;
    };
  };

  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.name, 'Delta Hub');
  assert.equal(body.data.address, '73 Links Way');
  assert.equal(body.data.timezone, 'Africa/Johannesburg');
  assert.equal(body.data.status, 'active');
});

test('GET /locations/:id — staff can fetch own org location', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const location = await prisma.location.findFirst({
    where: { organizationId: primaryOrgId, name: 'Beta Yard' },
    select: { id: true },
  });
  assert.ok(location?.id);

  const res = await fetch(`${baseUrl}/locations/${location.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; name: string } };
  assert.equal(body.data.id, location.id);
  assert.equal(body.data.name, 'Beta Yard');
});

test('GET /locations/:id — location in another org returns 404', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/locations/${otherOrgLocationId}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('PATCH /locations/:id — org_admin can update location', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const location = await prisma.location.findFirst({
    where: { organizationId: primaryOrgId, name: 'Gamma Storage' },
    select: { id: true },
  });
  assert.ok(location?.id);

  const res = await fetch(`${baseUrl}/locations/${location.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Gamma Storage Updated',
      address: '44 Green Street Updated',
      timezone: 'Europe/London',
      status: 'inactive',
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: {
      id: string;
      name: string;
      address: string | null;
      timezone: string;
      status: string;
    };
  };

  assert.equal(body.data.id, location.id);
  assert.equal(body.data.name, 'Gamma Storage Updated');
  assert.equal(body.data.address, '44 Green Street Updated');
  assert.equal(body.data.timezone, 'Europe/London');
  assert.equal(body.data.status, 'inactive');
});

test('PATCH /locations/:id — staff role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const location = await prisma.location.findFirst({
    where: { organizationId: primaryOrgId },
    select: { id: true },
  });
  assert.ok(location?.id);

  const res = await fetch(`${baseUrl}/locations/${location.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Staff Cannot Patch' }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

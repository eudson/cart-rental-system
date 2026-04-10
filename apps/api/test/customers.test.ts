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
const PRIMARY_ORG_SLUG = 'test-customers-phase3-primary-org';
const OTHER_ORG_SLUG = 'test-customers-phase3-other-org';
const ORG_SLUG_PREFIX = 'test-customers-phase3-';

const SUPER_ADMIN_EMAIL = 'super-admin@test-customers-phase3.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-customers-phase3.com';
const STAFF_EMAIL = 'staff@test-customers-phase3.com';
const LIST_TARGET_EMAIL = 'list-target@test-customers-phase3.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let primaryOrgId: string;
let otherOrgCustomerId: string;

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
    data: { name: 'Primary Customers Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Customers Org', slug: OTHER_ORG_SLUG },
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

  await prisma.customer.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'List Target Customer',
      email: LIST_TARGET_EMAIL,
      phone: '+27000000001',
      idNumber: 'ID-LIST-1',
      passwordHash,
    },
  });

  const otherOrgCustomer = await prisma.customer.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Org Hidden Customer',
      email: 'hidden@test-customers-phase3.com',
      passwordHash,
    },
  });
  otherOrgCustomerId = otherOrgCustomer.id;
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

test('GET /customers — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/customers`);
  assert.equal(res.status, 401);
});

test('GET /customers — staff can list customers in own org with pagination metadata', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/customers?page=1&pageSize=10&search=List Target`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; name: string; email: string }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.name, 'List Target Customer');
  assert.equal(body.data[0]?.email, LIST_TARGET_EMAIL);
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'List Target');
});

test('POST /customers — staff can create customer and password is hashed', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const newEmail = `created-${Date.now()}@test-customers-phase3.com`;
  const plaintextPassword = 'CustomerPassword1!';

  const res = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Created Customer',
      email: newEmail,
      phone: '+27000000002',
      idNumber: 'ID-CREATED-1',
      password: plaintextPassword,
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    data: {
      id: string;
      organizationId: string;
      name: string;
      email: string;
      isActive: boolean;
      passwordHash?: unknown;
    };
  };

  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.name, 'Created Customer');
  assert.equal(body.data.email, newEmail);
  assert.equal(body.data.isActive, true);
  assert.equal('passwordHash' in body.data, false);

  const createdCustomer = await prisma.customer.findUnique({ where: { id: body.data.id } });
  assert.ok(createdCustomer?.passwordHash);
  assert.notEqual(createdCustomer?.passwordHash, plaintextPassword);
  const passwordMatches = await bcrypt.compare(plaintextPassword, createdCustomer!.passwordHash);
  assert.equal(passwordMatches, true);
});

test('POST /customers — duplicate email in org returns CUSTOMER_EMAIL_EXISTS', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Duplicate Email Customer',
      email: LIST_TARGET_EMAIL,
      password: 'CustomerPassword1!',
    }),
  });

  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'CUSTOMER_EMAIL_EXISTS');
});

test('GET /customers/:id — staff can fetch customer in own org', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const customer = await prisma.customer.findUnique({
    where: { organizationId_email: { organizationId: primaryOrgId, email: LIST_TARGET_EMAIL } },
    select: { id: true },
  });
  assert.ok(customer?.id);

  const res = await fetch(`${baseUrl}/customers/${customer.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; email: string } };
  assert.equal(body.data.id, customer.id);
  assert.equal(body.data.email, LIST_TARGET_EMAIL);
});

test('GET /customers/:id — customer from another org returns 404', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/customers/${otherOrgCustomerId}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('PATCH /customers/:id — org_admin can update customer and password hash', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const customer = await prisma.customer.findUnique({
    where: { organizationId_email: { organizationId: primaryOrgId, email: LIST_TARGET_EMAIL } },
    select: { id: true },
  });
  assert.ok(customer?.id);

  const newPassword = 'UpdatedCustomerPassword123!';

  const res = await fetch(`${baseUrl}/customers/${customer.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'List Target Customer Updated',
      phone: '+27000000009',
      idNumber: 'ID-LIST-UPDATED',
      password: newPassword,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: { id: string; name: string; phone: string | null; passwordHash?: unknown };
  };
  assert.equal(body.data.id, customer.id);
  assert.equal(body.data.name, 'List Target Customer Updated');
  assert.equal(body.data.phone, '+27000000009');
  assert.equal('passwordHash' in body.data, false);

  const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.ok(updatedCustomer?.passwordHash);
  const passwordMatches = await bcrypt.compare(newPassword, updatedCustomer!.passwordHash);
  assert.equal(passwordMatches, true);
});

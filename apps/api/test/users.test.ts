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
const PRIMARY_ORG_SLUG = 'test-users-phase3-primary-org';
const OTHER_ORG_SLUG = 'test-users-phase3-other-org';
const ORG_SLUG_PREFIX = 'test-users-phase3-';

const SUPER_ADMIN_EMAIL = 'super-admin@test-users-phase3.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-users-phase3.com';
const STAFF_EMAIL = 'staff@test-users-phase3.com';
const LIST_TARGET_EMAIL = 'list-target@test-users-phase3.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let primaryOrgId: string;
let primaryLocationId: string;
let otherOrgUserId: string;

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
    data: { name: 'Primary Users Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Users Org', slug: OTHER_ORG_SLUG },
  });

  const primaryLocation = await prisma.location.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Users Primary Location',
      timezone: 'UTC',
    },
  });
  primaryLocationId = primaryLocation.id;

  await prisma.user.createMany({
    data: [
      {
        organizationId: primaryOrg.id,
        locationId: primaryLocation.id,
        name: 'Super Admin User',
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'super_admin',
      },
      {
        organizationId: primaryOrg.id,
        locationId: primaryLocation.id,
        name: 'Org Admin User',
        email: ORG_ADMIN_EMAIL,
        passwordHash,
        role: 'org_admin',
      },
      {
        organizationId: primaryOrg.id,
        locationId: primaryLocation.id,
        name: 'Staff User',
        email: STAFF_EMAIL,
        passwordHash,
        role: 'staff',
      },
      {
        organizationId: primaryOrg.id,
        locationId: primaryLocation.id,
        name: 'List Target User',
        email: LIST_TARGET_EMAIL,
        passwordHash,
        role: 'staff',
      },
    ],
  });

  const otherOrgUser = await prisma.user.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Org Hidden User',
      email: 'hidden@test-users-phase3.com',
      passwordHash,
      role: 'staff',
    },
  });
  otherOrgUserId = otherOrgUser.id;
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

test('GET /users — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/users`);
  assert.equal(res.status, 401);
});

test('GET /users — staff can list users in own org with pagination metadata', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/users?page=1&pageSize=10&search=List Target`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; name: string; email: string }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.name, 'List Target User');
  assert.equal(body.data[0]?.email, LIST_TARGET_EMAIL);
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'List Target');
});

test('POST /users — staff role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Staff Forbidden Create',
      email: 'staff-forbidden-create@test-users-phase3.com',
      password: 'MyStrongPassword1!',
      role: 'staff',
    }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('POST /users — org_admin can create user and password is hashed', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const newEmail = `created-${Date.now()}@test-users-phase3.com`;
  const plaintextPassword = 'MyStrongPassword1!';

  const res = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Created User',
      email: newEmail,
      password: plaintextPassword,
      role: 'staff',
      locationId: primaryLocationId,
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    data: {
      id: string;
      organizationId: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      passwordHash?: unknown;
    };
  };

  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.name, 'Created User');
  assert.equal(body.data.email, newEmail);
  assert.equal(body.data.role, 'staff');
  assert.equal(body.data.isActive, true);
  assert.equal('passwordHash' in body.data, false);

  const createdUser = await prisma.user.findUnique({ where: { id: body.data.id } });
  assert.ok(createdUser?.passwordHash);
  assert.notEqual(createdUser?.passwordHash, plaintextPassword);
  const passwordMatches = await bcrypt.compare(plaintextPassword, createdUser!.passwordHash);
  assert.equal(passwordMatches, true);
});

test('POST /users — duplicate email in org returns 409', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const res = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Duplicate Email User',
      email: LIST_TARGET_EMAIL,
      password: 'MyStrongPassword1!',
      role: 'staff',
    }),
  });

  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'CONFLICT');
});

test('GET /users/:id — staff can fetch user in own org', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: primaryOrgId, email: LIST_TARGET_EMAIL } },
    select: { id: true },
  });
  assert.ok(user?.id);

  const res = await fetch(`${baseUrl}/users/${user.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; email: string } };
  assert.equal(body.data.id, user.id);
  assert.equal(body.data.email, LIST_TARGET_EMAIL);
});

test('GET /users/:id — user from another org returns 404', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);

  const res = await fetch(`${baseUrl}/users/${otherOrgUserId}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('PATCH /users/:id — org_admin can update user details and password hash', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: primaryOrgId, email: LIST_TARGET_EMAIL } },
    select: { id: true },
  });
  assert.ok(user?.id);

  const newPassword = 'UpdatedPassword123!';

  const res = await fetch(`${baseUrl}/users/${user.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'List Target Updated',
      role: 'org_admin',
      password: newPassword,
      locationId: primaryLocationId,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: { id: string; name: string; role: string; passwordHash?: unknown };
  };
  assert.equal(body.data.id, user.id);
  assert.equal(body.data.name, 'List Target Updated');
  assert.equal(body.data.role, 'org_admin');
  assert.equal('passwordHash' in body.data, false);

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(updatedUser?.passwordHash);
  const passwordMatches = await bcrypt.compare(newPassword, updatedUser!.passwordHash);
  assert.equal(passwordMatches, true);
});

test('PATCH /users/:id — staff role returns 403', async () => {
  const staffToken = await loginAs(STAFF_EMAIL);
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: primaryOrgId, email: ORG_ADMIN_EMAIL } },
    select: { id: true },
  });
  assert.ok(user?.id);

  const res = await fetch(`${baseUrl}/users/${user.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Staff Cannot Update' }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('DELETE /users/:id — org_admin performs soft delete (isActive=false)', async () => {
  const orgAdminToken = await loginAs(ORG_ADMIN_EMAIL);

  const createdUser = await prisma.user.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      name: 'Soft Delete Target',
      email: `soft-delete-${Date.now()}@test-users-phase3.com`,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      role: 'staff',
      isActive: true,
    },
  });

  const res = await fetch(`${baseUrl}/users/${createdUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${orgAdminToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; isActive: boolean } };
  assert.equal(body.data.id, createdUser.id);
  assert.equal(body.data.isActive, false);

  const userAfter = await prisma.user.findUnique({ where: { id: createdUser.id } });
  assert.equal(userAfter?.isActive, false);
});

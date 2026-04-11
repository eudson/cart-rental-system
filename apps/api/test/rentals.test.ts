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
const PRIMARY_ORG_SLUG = 'test-rentals-phase4-primary-org';
const OTHER_ORG_SLUG = 'test-rentals-phase4-other-org';
const ORG_SLUG_PREFIX = 'test-rentals-phase4-';

const STAFF_EMAIL = 'staff@test-rentals-phase4.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-rentals-phase4.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

let primaryOrgId: string;
let primaryLocationId: string;
let primaryCustomerId: string;
let primaryAvailableCartId: string;
let primaryUnavailableCartId: string;
let primaryOverlapCartId: string;

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
    data: { name: 'Primary Rentals Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Rentals Org', slug: OTHER_ORG_SLUG },
  });

  await prisma.user.createMany({
    data: [
      {
        organizationId: primaryOrg.id,
        name: 'Primary Staff',
        email: STAFF_EMAIL,
        passwordHash,
        role: 'staff',
      },
      {
        organizationId: primaryOrg.id,
        name: 'Primary Org Admin',
        email: ORG_ADMIN_EMAIL,
        passwordHash,
        role: 'org_admin',
      },
    ],
  });

  const createdBy = await prisma.user.findFirst({
    where: {
      organizationId: primaryOrg.id,
      email: STAFF_EMAIL,
    },
    select: { id: true },
  });
  assert.ok(createdBy?.id);

  const primaryLocation = await prisma.location.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Primary Rentals Yard',
      timezone: 'UTC',
    },
  });
  primaryLocationId = primaryLocation.id;

  const primaryCartType = await prisma.cartType.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Rentals Standard',
      dailyRate: 75,
      monthlyRate: 1200,
      seatingCapacity: 2,
    },
  });

  const availableCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocation.id,
      cartTypeId: primaryCartType.id,
      label: 'RENT-100',
      status: 'available',
    },
  });
  primaryAvailableCartId = availableCart.id;

  const unavailableCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocation.id,
      cartTypeId: primaryCartType.id,
      label: 'RENT-200',
      status: 'rented',
    },
  });
  primaryUnavailableCartId = unavailableCart.id;

  const overlapCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocation.id,
      cartTypeId: primaryCartType.id,
      label: 'RENT-300',
      status: 'available',
    },
  });
  primaryOverlapCartId = overlapCart.id;

  const primaryCustomer = await prisma.customer.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Primary Rental Customer',
      email: 'primary-rental-customer@test-rentals-phase4.com',
      passwordHash,
    },
  });
  primaryCustomerId = primaryCustomer.id;

  await prisma.rental.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocation.id,
      customerId: primaryCustomer.id,
      cartId: overlapCart.id,
      createdById: createdBy.id,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-06-10T00:00:00.000Z'),
      endDate: new Date('2026-06-12T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const otherOrgLocation = await prisma.location.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Rentals Yard',
      timezone: 'UTC',
    },
  });

  await prisma.cartType.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Cart Type',
      dailyRate: 65,
      monthlyRate: 1100,
      seatingCapacity: 2,
    },
  });

  const otherOrgCustomer = await prisma.customer.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Rental Customer',
      email: 'other-rental-customer@test-rentals-phase4.com',
      passwordHash,
    },
  });
  otherOrgCustomerId = otherOrgCustomer.id;

  await prisma.cart.create({
    data: {
      organizationId: otherOrg.id,
      locationId: otherOrgLocation.id,
      cartTypeId: (await prisma.cartType.findFirstOrThrow({
        where: { organizationId: otherOrg.id },
        select: { id: true },
      })).id,
      label: 'OTHER-RENT-100',
      status: 'available',
    },
  });
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
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      organizationSlug: PRIMARY_ORG_SLUG,
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as LoginResponse;
  return body.data.accessToken;
}

test('POST /rentals — missing JWT returns 401', async () => {
  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'daily',
      customerId: primaryCustomerId,
      cartId: primaryAvailableCartId,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-04T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 401);
});

test('POST /rentals — staff can create a daily rental with rate snapshot and reserved cart', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'daily',
      customerId: primaryCustomerId,
      cartId: primaryAvailableCartId,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-04T00:00:00.000Z',
      notes: 'first daily rental',
    }),
  });

  assert.equal(response.status, 201);

  const body = (await response.json()) as {
    data: {
      id: string;
      organizationId: string;
      locationId: string;
      customerId: string;
      cartId: string;
      type: string;
      status: string;
      dailyRateSnapshot: string | null;
      totalAmount: string | null;
      notes: string | null;
    };
  };

  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.locationId, primaryLocationId);
  assert.equal(body.data.customerId, primaryCustomerId);
  assert.equal(body.data.cartId, primaryAvailableCartId);
  assert.equal(body.data.type, 'daily');
  assert.equal(body.data.status, 'pending');
  assert.equal(body.data.dailyRateSnapshot, '75');
  assert.equal(body.data.totalAmount, '225');
  assert.equal(body.data.notes, 'first daily rental');

  const updatedCart = await prisma.cart.findUnique({
    where: { id: primaryAvailableCartId },
    select: { status: true },
  });
  assert.equal(updatedCart?.status, 'reserved');
});

test('POST /rentals — cart not in available status returns CART_NOT_AVAILABLE', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'daily',
      customerId: primaryCustomerId,
      cartId: primaryUnavailableCartId,
      startDate: '2026-06-05T00:00:00.000Z',
      endDate: '2026-06-07T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'CART_NOT_AVAILABLE');
});

test('POST /rentals — overlapping rental returns RENTAL_OVERLAP', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'daily',
      customerId: primaryCustomerId,
      cartId: primaryOverlapCartId,
      startDate: '2026-06-11T00:00:00.000Z',
      endDate: '2026-06-13T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'RENTAL_OVERLAP');
});

test('POST /rentals — customer from another org returns 404', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'daily',
      customerId: otherOrgCustomerId,
      cartId: primaryOverlapCartId,
      startDate: '2026-06-14T00:00:00.000Z',
      endDate: '2026-06-15T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('POST /rentals — startDate must be before endDate', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'daily',
      customerId: primaryCustomerId,
      cartId: primaryOverlapCartId,
      startDate: '2026-06-15T00:00:00.000Z',
      endDate: '2026-06-14T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

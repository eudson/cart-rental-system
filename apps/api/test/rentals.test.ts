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
let primaryCartTypeId: string;
let primaryStaffUserId: string;
let primaryAvailableCartId: string;
let primaryUnavailableCartId: string;
let primaryOverlapCartId: string;
let primaryLeaseCartId: string;

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
  primaryStaffUserId = createdBy.id;

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
  primaryCartTypeId = primaryCartType.id;

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

  const leaseCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocation.id,
      cartTypeId: primaryCartType.id,
      label: 'RENT-400',
      status: 'available',
    },
  });
  primaryLeaseCartId = leaseCart.id;

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

let actionSequence = 0;

function nextActionLabel(prefix: string): string {
  actionSequence += 1;
  return `${prefix}-${actionSequence}`;
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

test('POST /rentals — lease rental enforces min contract months', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'lease',
      customerId: primaryCustomerId,
      cartId: primaryLeaseCartId,
      startDate: '2026-08-01T00:00:00.000Z',
      contractMonths: 5,
      notes: 'lease below minimum',
    }),
  });

  assert.equal(response.status, 422);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'LEASE_MIN_MONTHS');
});

test('POST /rentals — staff can create lease rental with monthly snapshot and total amount', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'lease',
      customerId: primaryCustomerId,
      cartId: primaryLeaseCartId,
      startDate: '2026-08-01T00:00:00.000Z',
      contractMonths: 6,
      notes: 'initial lease rental',
    }),
  });

  assert.equal(response.status, 201);
  const body = (await response.json()) as {
    data: {
      id: string;
      type: string;
      status: string;
      cartId: string;
      dailyRateSnapshot: string | null;
      monthlyRateSnapshot: string | null;
      totalAmount: string | null;
      endDate: string;
    };
  };

  assert.ok(body.data.id);
  assert.equal(body.data.type, 'lease');
  assert.equal(body.data.status, 'pending');
  assert.equal(body.data.cartId, primaryLeaseCartId);
  assert.equal(body.data.dailyRateSnapshot, null);
  assert.equal(body.data.monthlyRateSnapshot, '1200');
  assert.equal(body.data.totalAmount, '7200');
  assert.equal(body.data.endDate, '2027-02-01T00:00:00.000Z');

  const updatedCart = await prisma.cart.findUnique({
    where: { id: primaryLeaseCartId },
    select: { status: true },
  });
  assert.equal(updatedCart?.status, 'reserved');
});

test('POST /rentals/:id/contract — creates lease contract record', async () => {
  const token = await loginAs(STAFF_EMAIL);
  const leaseRental = await prisma.rental.findFirst({
    where: {
      organizationId: primaryOrgId,
      cartId: primaryLeaseCartId,
      type: 'lease',
    },
    select: { id: true },
  });
  assert.ok(leaseRental?.id);

  const response = await fetch(`${baseUrl}/rentals/${leaseRental.id}/contract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contractMonths: 6,
      earlyTerminationFee: 300,
    }),
  });

  assert.equal(response.status, 201);
  const body = (await response.json()) as {
    data: {
      rentalId: string;
      contractMonths: number;
      earlyTerminationFee: string | null;
    };
  };
  assert.equal(body.data.rentalId, leaseRental.id);
  assert.equal(body.data.contractMonths, 6);
  assert.equal(body.data.earlyTerminationFee, '300');
});

test('PATCH /rentals/:id/contract — updates lease contract fields', async () => {
  const token = await loginAs(STAFF_EMAIL);
  const leaseRental = await prisma.rental.findFirst({
    where: {
      organizationId: primaryOrgId,
      cartId: primaryLeaseCartId,
      type: 'lease',
    },
    select: { id: true },
  });
  assert.ok(leaseRental?.id);

  const response = await fetch(`${baseUrl}/rentals/${leaseRental.id}/contract`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signedAt: '2026-08-05T12:00:00.000Z',
      documentUrl: 'https://files.example.com/contracts/lease-001.pdf',
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: {
      rentalId: string;
      signedAt: string | null;
      documentUrl: string | null;
    };
  };
  assert.equal(body.data.rentalId, leaseRental.id);
  assert.equal(body.data.signedAt, '2026-08-05T12:00:00.000Z');
  assert.equal(
    body.data.documentUrl,
    'https://files.example.com/contracts/lease-001.pdf',
  );
});

test('GET /rentals/:id/contract — returns lease contract details', async () => {
  const token = await loginAs(STAFF_EMAIL);
  const leaseRental = await prisma.rental.findFirst({
    where: {
      organizationId: primaryOrgId,
      cartId: primaryLeaseCartId,
      type: 'lease',
    },
    select: { id: true },
  });
  assert.ok(leaseRental?.id);

  const response = await fetch(`${baseUrl}/rentals/${leaseRental.id}/contract`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: {
      rentalId: string;
      contractMonths: number;
      signedAt: string | null;
      documentUrl: string | null;
    };
  };

  assert.equal(body.data.rentalId, leaseRental.id);
  assert.equal(body.data.contractMonths, 6);
  assert.equal(body.data.signedAt, '2026-08-05T12:00:00.000Z');
  assert.equal(
    body.data.documentUrl,
    'https://files.example.com/contracts/lease-001.pdf',
  );
});

test('POST /rentals/:id/checkout — pending rental becomes active and cart becomes rented', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-CHECKOUT-CART'),
      status: 'reserved',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-03T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { id: string; status: string } };
  assert.equal(body.data.id, rental.id);
  assert.equal(body.data.status, 'active');

  const updatedCart = await prisma.cart.findUnique({
    where: { id: actionCart.id },
    select: { status: true },
  });
  assert.equal(updatedCart?.status, 'rented');
});

test('POST /rentals/:id/checkout — invalid status transition returns INVALID_STATUS_TRANSITION', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-CHECKOUT-INVALID-CART'),
      status: 'rented',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'active',
      startDate: new Date('2026-10-04T00:00:00.000Z'),
      endDate: new Date('2026-10-06T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 422);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'INVALID_STATUS_TRANSITION');
});

test('POST /rentals/:id/checkin — active rental becomes completed and cart becomes available', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-CHECKIN-CART'),
      status: 'rented',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'active',
      startDate: new Date('2026-10-07T00:00:00.000Z'),
      endDate: new Date('2026-10-09T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}/checkin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { id: string; status: string; actualReturnDate: string | null; totalAmount: string | null };
  };
  assert.equal(body.data.id, rental.id);
  assert.equal(body.data.status, 'completed');
  assert.ok(body.data.actualReturnDate);
  assert.equal(body.data.totalAmount, '150');

  const updatedCart = await prisma.cart.findUnique({
    where: { id: actionCart.id },
    select: { status: true },
  });
  assert.equal(updatedCart?.status, 'available');
});

test('POST /rentals/:id/cancel — pending rental becomes cancelled and cart becomes available', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-CANCEL-CART'),
      status: 'reserved',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-12T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { id: string; status: string } };
  assert.equal(body.data.id, rental.id);
  assert.equal(body.data.status, 'cancelled');

  const updatedCart = await prisma.cart.findUnique({
    where: { id: actionCart.id },
    select: { status: true },
  });
  assert.equal(updatedCart?.status, 'available');
});

test('GET /rentals — supports filters and pagination metadata', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-LIST-CART'),
      status: 'reserved',
    },
  });

  await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-10-13T00:00:00.000Z'),
      endDate: new Date('2026-10-15T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
      notes: 'action-list-target',
    },
  });

  const response = await fetch(
    `${baseUrl}/rentals?page=1&pageSize=10&search=action-list-target&type=daily&status=pending&customerId=${primaryCustomerId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: Array<{ id: string; type: string; status: string; notes: string | null }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };

  assert.ok(body.data.length >= 1);
  assert.equal(body.data[0]?.type, 'daily');
  assert.equal(body.data[0]?.status, 'pending');
  assert.equal(body.meta.pagination.search, 'action-list-target');
  assert.ok(body.meta.pagination.totalItems >= 1);
});

test('GET /rentals/:id — returns rental details for same org', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-DETAIL-CART'),
      status: 'reserved',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-10-16T00:00:00.000Z'),
      endDate: new Date('2026-10-18T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
      notes: 'action-detail-target',
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { id: string; notes: string | null } };
  assert.equal(body.data.id, rental.id);
  assert.equal(body.data.notes, 'action-detail-target');
});

test('PATCH /rentals/:id — updates pending rental dates, notes, and total amount', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-PATCH-CART'),
      status: 'reserved',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-10-19T00:00:00.000Z'),
      endDate: new Date('2026-10-21T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
      notes: 'old patch notes',
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endDate: '2026-10-22T00:00:00.000Z',
      notes: 'new patch notes',
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { id: string; endDate: string; notes: string | null; totalAmount: string | null };
  };
  assert.equal(body.data.id, rental.id);
  assert.equal(body.data.endDate, '2026-10-22T00:00:00.000Z');
  assert.equal(body.data.notes, 'new patch notes');
  assert.equal(body.data.totalAmount, '225');
});

test('PATCH /rentals/:id — active rental date update returns INVALID_STATUS_TRANSITION', async () => {
  const token = await loginAs(STAFF_EMAIL);

  const actionCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      cartTypeId: primaryCartTypeId,
      label: nextActionLabel('ACTION-PATCH-ACTIVE-CART'),
      status: 'rented',
    },
  });

  const rental = await prisma.rental.create({
    data: {
      organizationId: primaryOrgId,
      locationId: primaryLocationId,
      customerId: primaryCustomerId,
      cartId: actionCart.id,
      createdById: primaryStaffUserId,
      type: 'daily',
      status: 'active',
      startDate: new Date('2026-10-23T00:00:00.000Z'),
      endDate: new Date('2026-10-25T00:00:00.000Z'),
      dailyRateSnapshot: 75,
      totalAmount: 150,
    },
  });

  const response = await fetch(`${baseUrl}/rentals/${rental.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endDate: '2026-10-26T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 422);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'INVALID_STATUS_TRANSITION');
});

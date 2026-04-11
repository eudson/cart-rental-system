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
const PRIMARY_ORG_SLUG = 'test-portal-phase6-primary-org';
const OTHER_ORG_SLUG = 'test-portal-phase6-other-org';
const ORG_SLUG_PREFIX = 'test-portal-phase6-';

const CUSTOMER_EMAIL = 'customer@test-portal-phase6.com';
const OTHER_CUSTOMER_EMAIL = 'other-customer@test-portal-phase6.com';
const STAFF_EMAIL = 'staff@test-portal-phase6.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

let primaryOrgId: string;
let primaryCustomerId: string;
let primaryRentalId: string;
let primaryLeaseRentalId: string;
let otherCustomerId: string;
let otherOrgCustomerId: string;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsCustomer(
  email: string,
  orgSlug: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, organizationSlug: orgSlug }),
  });
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function loginAsStaff(email: string, orgSlug: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, organizationSlug: orgSlug }),
  });
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function cleanupTestData(db: PrismaService): Promise<void> {
  const orgs = await db.organization.findMany({
    where: { slug: { startsWith: ORG_SLUG_PREFIX } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  if (orgIds.length === 0) return;

  await db.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.leaseContract.deleteMany({ where: { rental: { organizationId: { in: orgIds } } } });
  await db.rental.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.cart.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.cartType.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.user.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.location.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
}

// ── Setup ────────────────────────────────────────────────────────────────────

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
    data: { name: 'Primary Portal Org', slug: PRIMARY_ORG_SLUG, minLeaseMonths: 6 },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Portal Org', slug: OTHER_ORG_SLUG },
  });

  const location = await prisma.location.create({
    data: { organizationId: primaryOrg.id, name: 'Test Depot', timezone: 'UTC' },
  });

  const cartType = await prisma.cartType.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Standard',
      dailyRate: '50.00',
      monthlyRate: '900.00',
      seatingCapacity: 2,
    },
  });

  const cart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: location.id,
      cartTypeId: cartType.id,
      label: 'P-001',
      year: 2023,
      color: 'Blue',
      status: 'available',
    },
  });

  const secondCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: location.id,
      cartTypeId: cartType.id,
      label: 'P-002',
      year: 2023,
      color: 'Red',
      status: 'available',
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Staff User',
      email: STAFF_EMAIL,
      passwordHash,
      role: 'staff',
    },
  });

  const primaryCustomer = await prisma.customer.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Primary Customer',
      email: CUSTOMER_EMAIL,
      passwordHash,
    },
  });
  primaryCustomerId = primaryCustomer.id;

  // A second customer in same org (should not see primary customer's rentals)
  const otherCustomer = await prisma.customer.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Other Customer',
      email: OTHER_CUSTOMER_EMAIL,
      passwordHash,
    },
  });
  otherCustomerId = otherCustomer.id;

  // A customer in a different org (cross-org isolation)
  const otherOrgCustomer = await prisma.customer.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Cross Org Customer',
      email: 'cross@test-portal-phase6.com',
      passwordHash,
    },
  });
  otherOrgCustomerId = otherOrgCustomer.id;

  // Create a daily rental for primary customer
  const dailyRental = await prisma.rental.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: location.id,
      customerId: primaryCustomer.id,
      cartId: cart.id,
      createdById: staffUser.id,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-03'),
      dailyRateSnapshot: '50.00',
      totalAmount: '100.00',
    },
  });
  primaryRentalId = dailyRental.id;

  // Create a lease rental for primary customer
  const leaseRental = await prisma.rental.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: location.id,
      customerId: primaryCustomer.id,
      cartId: secondCart.id,
      createdById: staffUser.id,
      type: 'lease',
      status: 'active',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-07-01'),
      monthlyRateSnapshot: '900.00',
      totalAmount: '5400.00',
    },
  });
  primaryLeaseRentalId = leaseRental.id;

  // Add a lease contract to the lease rental
  await prisma.leaseContract.create({
    data: { rentalId: leaseRental.id, contractMonths: 6 },
  });

  // Record a payment on the daily rental
  await prisma.payment.create({
    data: {
      rentalId: dailyRental.id,
      organizationId: primaryOrg.id,
      recordedById: staffUser.id,
      amount: '100.00',
      method: 'cash',
      status: 'paid',
      paidAt: new Date(),
    },
  });
});

after(async () => {
  await cleanupTestData(prisma);
  await app.close();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test('GET /portal/me — returns own customer profile', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { data: { id: string; email: string } };

  assert.equal(res.status, 200);
  assert.equal(body.data.id, primaryCustomerId);
  assert.equal(body.data.email, CUSTOMER_EMAIL);
});

test('GET /portal/me — rejects unauthenticated request', async () => {
  const res = await fetch(`${baseUrl}/portal/me`);
  assert.equal(res.status, 401);
});

test('GET /portal/me — rejects staff JWT', async () => {
  const token = await loginAsStaff(STAFF_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 401);
});

test('GET /portal/rentals — returns only own rentals', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { data: { customerId: string }[] };

  assert.equal(res.status, 200);
  assert.ok(body.data.length >= 2);
  for (const rental of body.data) {
    assert.equal(rental.customerId, primaryCustomerId);
  }
});

test('GET /portal/rentals — other customer sees only their own (empty)', async () => {
  const token = await loginAsCustomer(OTHER_CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    data: unknown[];
    meta: { pagination: { totalItems: number } };
  };

  assert.equal(res.status, 200);
  assert.equal(body.data.length, 0);
  assert.equal(body.meta.pagination.totalItems, 0);
});

test('GET /portal/rentals — status filter works', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals?status=pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { data: { status: string }[] };

  assert.equal(res.status, 200);
  for (const rental of body.data) {
    assert.equal(rental.status, 'pending');
  }
});

test('GET /portal/rentals — pagination meta is present', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals?page=1&pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    data: unknown[];
    meta: { pagination: { page: number; pageSize: number; totalItems: number } };
  };

  assert.equal(res.status, 200);
  assert.equal(body.meta.pagination.page, 1);
  assert.equal(body.meta.pagination.pageSize, 5);
  assert.ok(body.meta.pagination.totalItems >= 2);
});

test('GET /portal/rentals/:id — returns rental detail', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryRentalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { data: { id: string; customer: { id: string } } };

  assert.equal(res.status, 200);
  assert.equal(body.data.id, primaryRentalId);
  assert.equal(body.data.customer.id, primaryCustomerId);
});

test('GET /portal/rentals/:id — cannot access another customer rental', async () => {
  const token = await loginAsCustomer(OTHER_CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryRentalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
});

test('GET /portal/rentals/:id/contract — returns lease contract', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryLeaseRentalId}/contract`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    data: { rentalId: string; contractMonths: number };
  };

  assert.equal(res.status, 200);
  assert.equal(body.data.rentalId, primaryLeaseRentalId);
  assert.equal(body.data.contractMonths, 6);
});

test('GET /portal/rentals/:id/contract — 404 for daily rental (no contract)', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryRentalId}/contract`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { error: { code: string } };

  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'LEASE_CONTRACT_NOT_FOUND');
});

test('GET /portal/rentals/:id/payments — returns payment list', async () => {
  const token = await loginAsCustomer(CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryRentalId}/payments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    data: { amount: string }[];
    meta: { pagination: { totalItems: number } };
  };

  assert.equal(res.status, 200);
  assert.ok(body.data.length >= 1);
  // Prisma serializes Decimal without trailing zeros: '100.00' → '100'
  assert.ok(Number(body.data[0]!.amount) === 100);
});

test('GET /portal/rentals/:id/payments — cannot access another customer payments', async () => {
  const token = await loginAsCustomer(OTHER_CUSTOMER_EMAIL, PRIMARY_ORG_SLUG);
  const res = await fetch(`${baseUrl}/portal/rentals/${primaryRentalId}/payments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
});

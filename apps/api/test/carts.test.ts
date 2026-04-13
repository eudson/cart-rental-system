import 'reflect-metadata';

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import * as bcrypt from 'bcrypt';
import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_PASSWORD, loginAsStaff, setupTestApp } from './helpers';
const PRIMARY_ORG_SLUG = 'test-carts-phase3-primary-org';
const OTHER_ORG_SLUG = 'test-carts-phase3-other-org';
const ORG_SLUG_PREFIX = 'test-carts-phase3-';

const SUPER_ADMIN_EMAIL = 'super-admin@test-carts-phase3.com';
const ORG_ADMIN_EMAIL = 'org-admin@test-carts-phase3.com';
const STAFF_EMAIL = 'staff@test-carts-phase3.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let primaryOrgId: string;
let primaryLocationAId: string;
let primaryLocationBId: string;
let primaryCartTypeAId: string;
let primaryCartTypeBId: string;
let otherOrgCartId: string;
let overlapCartId: string;
let nonOverlapCartId: string;

const AVAILABILITY_WINDOW_START = '2026-05-10T00:00:00.000Z';
const AVAILABILITY_WINDOW_END = '2026-05-12T00:00:00.000Z';

before(async () => {
  ({ app, baseUrl, prisma } = await setupTestApp());

  await cleanupTestData(prisma);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const primaryOrg = await prisma.organization.create({
    data: { name: 'Primary Carts Org', slug: PRIMARY_ORG_SLUG },
  });
  primaryOrgId = primaryOrg.id;

  const otherOrg = await prisma.organization.create({
    data: { name: 'Other Carts Org', slug: OTHER_ORG_SLUG },
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

  const primaryLocationA = await prisma.location.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Primary Yard A',
      timezone: 'UTC',
    },
  });
  primaryLocationAId = primaryLocationA.id;

  const primaryLocationB = await prisma.location.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Primary Yard B',
      timezone: 'UTC',
    },
  });
  primaryLocationBId = primaryLocationB.id;

  const cartTypeA = await prisma.cartType.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Standard Type',
      dailyRate: 55,
      monthlyRate: 980,
      seatingCapacity: 2,
    },
  });
  primaryCartTypeAId = cartTypeA.id;

  const cartTypeB = await prisma.cartType.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Premium Type',
      dailyRate: 85,
      monthlyRate: 1450,
      seatingCapacity: 4,
    },
  });
  primaryCartTypeBId = cartTypeB.id;

  await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationA.id,
      cartTypeId: cartTypeA.id,
      label: 'Cart-100',
      color: 'white',
      status: 'available',
    },
  });

  await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationA.id,
      cartTypeId: cartTypeB.id,
      label: 'Cart-200',
      status: 'reserved',
    },
  });

  const overlapCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationA.id,
      cartTypeId: cartTypeA.id,
      label: 'Cart-300',
      status: 'available',
    },
  });
  overlapCartId = overlapCart.id;

  const nonOverlapCart = await prisma.cart.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationB.id,
      cartTypeId: cartTypeA.id,
      label: 'Cart-400',
      status: 'available',
    },
  });
  nonOverlapCartId = nonOverlapCart.id;

  const rentalCustomer = await prisma.customer.create({
    data: {
      organizationId: primaryOrg.id,
      name: 'Availability Customer',
      email: 'availability.customer@test-carts-phase3.com',
      passwordHash,
    },
  });
  const createdBy = await prisma.user.findFirst({
    where: {
      organizationId: primaryOrg.id,
      email: ORG_ADMIN_EMAIL,
    },
    select: { id: true },
  });
  assert.ok(createdBy?.id);

  await prisma.rental.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationA.id,
      customerId: rentalCustomer.id,
      cartId: overlapCart.id,
      createdById: createdBy.id,
      type: 'daily',
      status: 'pending',
      startDate: new Date('2026-05-10T10:00:00.000Z'),
      endDate: new Date('2026-05-12T10:00:00.000Z'),
    },
  });

  await prisma.rental.create({
    data: {
      organizationId: primaryOrg.id,
      locationId: primaryLocationB.id,
      customerId: rentalCustomer.id,
      cartId: nonOverlapCart.id,
      createdById: createdBy.id,
      type: 'daily',
      status: 'active',
      startDate: new Date('2026-05-01T10:00:00.000Z'),
      endDate: new Date('2026-05-03T10:00:00.000Z'),
    },
  });

  const otherOrgLocation = await prisma.location.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Yard',
      timezone: 'UTC',
    },
  });
  const otherOrgCartType = await prisma.cartType.create({
    data: {
      organizationId: otherOrg.id,
      name: 'Other Type',
      dailyRate: 60,
      monthlyRate: 1000,
      seatingCapacity: 2,
    },
  });
  const otherCart = await prisma.cart.create({
    data: {
      organizationId: otherOrg.id,
      locationId: otherOrgLocation.id,
      cartTypeId: otherOrgCartType.id,
      label: 'Hidden Cart',
      status: 'available',
    },
  });
  otherOrgCartId = otherCart.id;
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

test('GET /carts — missing JWT returns 401', async () => {
  const res = await fetch(`${baseUrl}/carts`);
  assert.equal(res.status, 401);
});

test('GET /carts — staff can list carts with filters and pagination metadata', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(
    `${baseUrl}/carts?page=1&pageSize=10&search=Cart-100&locationId=${primaryLocationAId}&status=available`,
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    },
  );
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; label: string; status: string }>;
    meta: { pagination: { totalItems: number; search: string | null } };
  };
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.label, 'Cart-100');
  assert.equal(body.data[0]?.status, 'available');
  assert.equal(body.meta.pagination.totalItems, 1);
  assert.equal(body.meta.pagination.search, 'Cart-100');
});

test('GET /carts/availability — returns only carts that are available with no overlap', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(
    `${baseUrl}/carts/availability?startDate=${encodeURIComponent(AVAILABILITY_WINDOW_START)}&endDate=${encodeURIComponent(AVAILABILITY_WINDOW_END)}&type=daily`,
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    },
  );
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; label: string }>;
  };
  const labels = body.data.map((cart) => cart.label);
  const cartIds = body.data.map((cart) => cart.id);

  assert.ok(labels.includes('Cart-100'));
  assert.ok(labels.includes('Cart-400'));
  assert.ok(!labels.includes('Cart-200'));
  assert.ok(!labels.includes('Cart-300'));
  assert.ok(!labels.includes('Hidden Cart'));
  assert.ok(cartIds.includes(nonOverlapCartId));
  assert.ok(!cartIds.includes(overlapCartId));
});

test('GET /carts/availability — locationId filter scopes result set', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(
    `${baseUrl}/carts/availability?startDate=${encodeURIComponent(AVAILABILITY_WINDOW_START)}&endDate=${encodeURIComponent(AVAILABILITY_WINDOW_END)}&locationId=${primaryLocationAId}&type=daily`,
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    },
  );
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    data: Array<{ id: string; label: string; locationId: string }>;
  };
  const labels = body.data.map((cart) => cart.label);

  assert.ok(labels.includes('Cart-100'));
  assert.ok(!labels.includes('Cart-400'));
  assert.ok(!labels.includes('Cart-300'));
  for (const cart of body.data) {
    assert.equal(cart.locationId, primaryLocationAId);
  }
});

test('GET /carts/availability — startDate must be before endDate', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(
    `${baseUrl}/carts/availability?startDate=${encodeURIComponent(AVAILABILITY_WINDOW_END)}&endDate=${encodeURIComponent(AVAILABILITY_WINDOW_START)}&type=daily`,
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    },
  );

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('POST /carts — staff role returns 403', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(`${baseUrl}/carts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: primaryLocationAId,
      cartTypeId: primaryCartTypeAId,
      label: 'STAFF-CART',
    }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('POST /carts — org_admin can create cart', async () => {
  const orgAdminToken = await loginAsStaff(baseUrl, ORG_ADMIN_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(`${baseUrl}/carts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: primaryLocationBId,
      cartTypeId: primaryCartTypeBId,
      label: 'NEW-CART-300',
      year: 2024,
      color: 'black',
      notes: 'newly registered cart',
      status: 'available',
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    data: {
      id: string;
      organizationId: string;
      label: string;
      locationId: string;
      cartTypeId: string;
      status: string;
    };
  };
  assert.ok(body.data.id);
  assert.equal(body.data.organizationId, primaryOrgId);
  assert.equal(body.data.label, 'NEW-CART-300');
  assert.equal(body.data.locationId, primaryLocationBId);
  assert.equal(body.data.cartTypeId, primaryCartTypeBId);
  assert.equal(body.data.status, 'available');
});

test('GET /carts/:id — staff can fetch own org cart', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);
  const cart = await prisma.cart.findFirst({
    where: { organizationId: primaryOrgId, label: 'Cart-100' },
    select: { id: true },
  });
  assert.ok(cart?.id);

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; label: string } };
  assert.equal(body.data.id, cart.id);
  assert.equal(body.data.label, 'Cart-100');
});

test('GET /carts/:id — cart from another org returns 404', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(`${baseUrl}/carts/${otherOrgCartId}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('PATCH /carts/:id — org_admin can update cart details', async () => {
  const orgAdminToken = await loginAsStaff(baseUrl, ORG_ADMIN_EMAIL, PRIMARY_ORG_SLUG);
  const cart = await prisma.cart.findFirst({
    where: { organizationId: primaryOrgId, label: 'Cart-100' },
    select: { id: true },
  });
  assert.ok(cart?.id);

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      label: 'Cart-100-Updated',
      locationId: primaryLocationBId,
      cartTypeId: primaryCartTypeBId,
      color: 'green',
      notes: 'updated by admin',
      year: 2025,
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: {
      id: string;
      label: string;
      locationId: string;
      cartTypeId: string;
      color: string | null;
      year: number | null;
    };
  };
  assert.equal(body.data.id, cart.id);
  assert.equal(body.data.label, 'Cart-100-Updated');
  assert.equal(body.data.locationId, primaryLocationBId);
  assert.equal(body.data.cartTypeId, primaryCartTypeBId);
  assert.equal(body.data.color, 'green');
  assert.equal(body.data.year, 2025);
});

test('PATCH /carts/:id — staff can update status with valid transition', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);
  const cart = await prisma.cart.findFirst({
    where: { organizationId: primaryOrgId, label: 'Cart-100-Updated' },
    select: { id: true },
  });
  assert.ok(cart?.id);

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'reserved' }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { id: string; status: string } };
  assert.equal(body.data.id, cart.id);
  assert.equal(body.data.status, 'reserved');
});

test('PATCH /carts/:id — staff cannot update non-status fields', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);
  const cart = await prisma.cart.findFirst({
    where: { organizationId: primaryOrgId, label: 'Cart-100-Updated' },
    select: { id: true },
  });
  assert.ok(cart?.id);

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ color: 'forbidden-blue' }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('PATCH /carts/:id — invalid status transition returns INVALID_STATUS_TRANSITION', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);
  const cart = await prisma.cart.findFirst({
    where: { organizationId: primaryOrgId, label: 'Cart-100-Updated' },
    select: { id: true },
  });
  assert.ok(cart?.id);

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'retired' }),
  });

  assert.equal(res.status, 422);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'INVALID_STATUS_TRANSITION');
});

test('POST /carts — missing required label returns 400', async () => {
  const orgAdminToken = await loginAsStaff(baseUrl, ORG_ADMIN_EMAIL, PRIMARY_ORG_SLUG);

  const res = await fetch(`${baseUrl}/carts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgAdminToken}`,
      'Content-Type': 'application/json',
    },
    // label is required but omitted
    body: JSON.stringify({
      locationId: primaryLocationAId,
      cartTypeId: primaryCartTypeAId,
      status: 'available',
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('PATCH /carts/:id — invalid status value returns 400', async () => {
  const staffToken = await loginAsStaff(baseUrl, STAFF_EMAIL, PRIMARY_ORG_SLUG);

  const cart = await prisma.cart.findFirstOrThrow({
    where: { organizationId: primaryOrgId, status: 'available' },
    select: { id: true },
  });

  const res = await fetch(`${baseUrl}/carts/${cart.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'broken_and_on_fire' }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

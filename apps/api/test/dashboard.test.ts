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
const ORG_SLUG = 'test-dashboard-phase6-org';
const ORG_SLUG_PREFIX = 'test-dashboard-phase6-';
const STAFF_EMAIL = 'staff@test-dashboard-phase6.com';

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let accessToken: string;

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

  const organization = await prisma.organization.create({
    data: {
      name: 'Dashboard Test Org',
      slug: ORG_SLUG,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Dashboard Staff',
      email: STAFF_EMAIL,
      passwordHash,
      role: 'staff',
    },
  });

  const [northLocation, southLocation] = await Promise.all([
    prisma.location.create({
      data: {
        organizationId: organization.id,
        name: 'North Yard',
        timezone: 'UTC',
      },
    }),
    prisma.location.create({
      data: {
        organizationId: organization.id,
        name: 'South Yard',
        timezone: 'UTC',
      },
    }),
  ]);

  const [standardType, leaseType] = await Promise.all([
    prisma.cartType.create({
      data: {
        organizationId: organization.id,
        name: 'Standard Fleet',
        dailyRate: 55,
        monthlyRate: 850,
        seatingCapacity: 2,
      },
    }),
    prisma.cartType.create({
      data: {
        organizationId: organization.id,
        name: 'Lease Fleet',
        dailyRate: 70,
        monthlyRate: 1200,
        seatingCapacity: 4,
      },
    }),
  ]);

  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      name: 'Dashboard Customer',
      email: 'customer@test-dashboard-phase6.com',
      passwordHash,
    },
  });

  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const middayTodayUtc = new Date(startOfTodayUtc);
  middayTodayUtc.setUTCHours(12, 0, 0, 0);
  const middayTomorrowUtc = new Date(middayTodayUtc);
  middayTomorrowUtc.setUTCDate(middayTomorrowUtc.getUTCDate() + 1);
  const middayYesterdayUtc = new Date(middayTodayUtc);
  middayYesterdayUtc.setUTCDate(middayYesterdayUtc.getUTCDate() - 1);
  const startOfYesterdayUtc = new Date(startOfTodayUtc);
  startOfYesterdayUtc.setUTCDate(startOfYesterdayUtc.getUTCDate() - 1);
  const endOfYesterdayUtc = new Date(startOfTodayUtc);
  endOfYesterdayUtc.setUTCMinutes(endOfYesterdayUtc.getUTCMinutes() - 1);
  const futureLeaseStartUtc = new Date(middayTomorrowUtc);
  futureLeaseStartUtc.setUTCDate(futureLeaseStartUtc.getUTCDate() + 2);
  const futureLeaseEndUtc = new Date(futureLeaseStartUtc);
  futureLeaseEndUtc.setUTCMonth(futureLeaseEndUtc.getUTCMonth() + 6);

  const [availableCart, reservedDailyCart, reservedLeaseCart, rentedDailyCart, rentedLeaseCart, retiredCart] =
    await Promise.all([
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: northLocation.id,
          cartTypeId: standardType.id,
          label: 'DASH-AVL-1',
          status: 'available',
        },
      }),
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: northLocation.id,
          cartTypeId: standardType.id,
          label: 'DASH-RES-1',
          status: 'reserved',
        },
      }),
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: southLocation.id,
          cartTypeId: leaseType.id,
          label: 'DASH-RES-2',
          status: 'reserved',
        },
      }),
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: northLocation.id,
          cartTypeId: standardType.id,
          label: 'DASH-RNT-1',
          status: 'rented',
        },
      }),
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: southLocation.id,
          cartTypeId: leaseType.id,
          label: 'DASH-RNT-2',
          status: 'rented',
        },
      }),
      prisma.cart.create({
        data: {
          organizationId: organization.id,
          locationId: southLocation.id,
          cartTypeId: standardType.id,
          label: 'DASH-RET-1',
          status: 'retired',
        },
      }),
    ]);

  await prisma.rental.create({
    data: {
      organizationId: organization.id,
      locationId: northLocation.id,
      customerId: customer.id,
      cartId: reservedDailyCart.id,
      createdById: staffUser.id,
      type: 'daily',
      status: 'pending',
      startDate: middayTodayUtc,
      endDate: middayTomorrowUtc,
      dailyRateSnapshot: 55,
      totalAmount: 55,
    },
  });

  await prisma.rental.create({
    data: {
      organizationId: organization.id,
      locationId: southLocation.id,
      customerId: customer.id,
      cartId: reservedLeaseCart.id,
      createdById: staffUser.id,
      type: 'lease',
      status: 'pending',
      startDate: futureLeaseStartUtc,
      endDate: futureLeaseEndUtc,
      monthlyRateSnapshot: 1200,
      totalAmount: 7200,
    },
  });

  const activeDailyRental = await prisma.rental.create({
    data: {
      organizationId: organization.id,
      locationId: northLocation.id,
      customerId: customer.id,
      cartId: rentedDailyCart.id,
      createdById: staffUser.id,
      type: 'daily',
      status: 'active',
      startDate: middayYesterdayUtc,
      endDate: middayTodayUtc,
      dailyRateSnapshot: 55,
      totalAmount: 110,
    },
  });

  const activeLeaseRental = await prisma.rental.create({
    data: {
      organizationId: organization.id,
      locationId: southLocation.id,
      customerId: customer.id,
      cartId: rentedLeaseCart.id,
      createdById: staffUser.id,
      type: 'lease',
      status: 'active',
      startDate: startOfYesterdayUtc,
      endDate: endOfYesterdayUtc,
      monthlyRateSnapshot: 1200,
      totalAmount: 7200,
    },
  });

  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      rentalId: activeLeaseRental.id,
      recordedById: staffUser.id,
      amount: 7200,
      method: 'bank_transfer',
      status: 'paid',
      paidAt: middayYesterdayUtc,
    },
  });

  assert.ok(availableCart.id);
  assert.ok(activeDailyRental.id);

  accessToken = await loginAs(STAFF_EMAIL);
});

after(async () => {
  await cleanupTestData(prisma);
  await app.close();
});

test('GET /dashboard/overview returns owner-focused operational summary', async () => {
  const response = await fetch(`${baseUrl}/dashboard/overview`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    data: {
      fleetOverview: {
        totalCarts: number;
        availableCarts: number;
        reservedCarts: number;
        rentedCarts: number;
        retiredCarts: number;
        utilizationRate: number;
      };
      rentalMix: {
        activeDailyRentals: number;
        activeLeaseRentals: number;
        pendingDailyRentals: number;
        pendingLeaseRentals: number;
        paymentAttentionRentals: number;
      };
      actionQueue: {
        checkoutsTodayCount: number;
        checkinsTodayCount: number;
        overdueReturnsCount: number;
        checkoutsToday: Array<{ cartLabel: string }>;
        checkinsToday: Array<{ cartLabel: string }>;
        overdueReturns: Array<{ cartLabel: string }>;
      };
      capacitySignals: {
        byLocation: Array<{
          name: string;
          totalCarts: number;
          availableCarts: number;
          reservedCarts: number;
          rentedCarts: number;
          retiredCarts: number;
          activeDailyRentals: number;
          activeLeaseRentals: number;
          utilizationRate: number;
        }>;
        byCartType: Array<{
          name: string;
          totalCarts: number;
          availableCarts: number;
          reservedCarts: number;
          rentedCarts: number;
          retiredCarts: number;
          activeDailyRentals: number;
          activeLeaseRentals: number;
          utilizationRate: number;
        }>;
      };
    };
    error: null;
  };

  assert.equal(body.error, null);
  assert.deepEqual(body.data.fleetOverview, {
    totalCarts: 6,
    availableCarts: 1,
    reservedCarts: 2,
    rentedCarts: 2,
    retiredCarts: 1,
    utilizationRate: 66.7,
  });

  assert.deepEqual(body.data.rentalMix, {
    activeDailyRentals: 1,
    activeLeaseRentals: 1,
    pendingDailyRentals: 1,
    pendingLeaseRentals: 1,
    paymentAttentionRentals: 1,
  });

  assert.equal(body.data.actionQueue.checkoutsTodayCount, 1);
  assert.equal(body.data.actionQueue.checkinsTodayCount, 1);
  assert.equal(body.data.actionQueue.overdueReturnsCount, 1);
  assert.equal(body.data.actionQueue.checkoutsToday[0]?.cartLabel, 'DASH-RES-1');
  assert.equal(body.data.actionQueue.checkinsToday[0]?.cartLabel, 'DASH-RNT-1');
  assert.equal(body.data.actionQueue.overdueReturns[0]?.cartLabel, 'DASH-RNT-2');

  assert.deepEqual(
    body.data.capacitySignals.byLocation.map((item) => ({
      name: item.name,
      totalCarts: item.totalCarts,
      availableCarts: item.availableCarts,
      reservedCarts: item.reservedCarts,
      rentedCarts: item.rentedCarts,
      retiredCarts: item.retiredCarts,
      activeDailyRentals: item.activeDailyRentals,
      activeLeaseRentals: item.activeLeaseRentals,
      utilizationRate: item.utilizationRate,
    })),
    [
      {
        name: 'South Yard',
        totalCarts: 3,
        availableCarts: 0,
        reservedCarts: 1,
        rentedCarts: 1,
        retiredCarts: 1,
        activeDailyRentals: 0,
        activeLeaseRentals: 1,
        utilizationRate: 66.7,
      },
      {
        name: 'North Yard',
        totalCarts: 3,
        availableCarts: 1,
        reservedCarts: 1,
        rentedCarts: 1,
        retiredCarts: 0,
        activeDailyRentals: 1,
        activeLeaseRentals: 0,
        utilizationRate: 66.7,
      },
    ],
  );

  assert.deepEqual(
    body.data.capacitySignals.byCartType.map((item) => ({
      name: item.name,
      totalCarts: item.totalCarts,
      availableCarts: item.availableCarts,
      reservedCarts: item.reservedCarts,
      rentedCarts: item.rentedCarts,
      retiredCarts: item.retiredCarts,
      activeDailyRentals: item.activeDailyRentals,
      activeLeaseRentals: item.activeLeaseRentals,
      utilizationRate: item.utilizationRate,
    })),
    [
      {
        name: 'Lease Fleet',
        totalCarts: 2,
        availableCarts: 0,
        reservedCarts: 1,
        rentedCarts: 1,
        retiredCarts: 0,
        activeDailyRentals: 0,
        activeLeaseRentals: 1,
        utilizationRate: 100,
      },
      {
        name: 'Standard Fleet',
        totalCarts: 4,
        availableCarts: 1,
        reservedCarts: 1,
        rentedCarts: 1,
        retiredCarts: 1,
        activeDailyRentals: 1,
        activeLeaseRentals: 0,
        utilizationRate: 50,
      },
    ],
  );
});

async function loginAs(email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      organizationSlug: ORG_SLUG,
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: {
      accessToken: string;
    };
  };

  return body.data.accessToken;
}

async function cleanupTestData(db: PrismaService): Promise<void> {
  const organizations = await db.organization.findMany({
    where: {
      slug: {
        startsWith: ORG_SLUG_PREFIX,
      },
    },
    select: {
      id: true,
    },
  });

  if (organizations.length === 0) {
    return;
  }

  const organizationIds = organizations.map((organization) => organization.id);

  await db.payment.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.leaseContract.deleteMany({
    where: {
      rental: {
        organizationId: {
          in: organizationIds,
        },
      },
    },
  });
  await db.rental.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.cart.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.cartType.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.customer.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.user.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.location.deleteMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
  });
  await db.organization.deleteMany({
    where: {
      id: {
        in: organizationIds,
      },
    },
  });
}
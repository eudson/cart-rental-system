/**
 * Dev seed — creates one org, one user per role, and one customer.
 * Safe to re-run: upserts on unique keys so existing data is not duplicated.
 *
 * Usage:
 *   pnpm db:seed
 *
 * Credentials after seeding:
 *   org slug : demo-org
 *   org_admin: admin@demo-org.com  / seed-password-admin
 *   staff    : staff@demo-org.com  / seed-password-staff
 *   customer : customer@demo-org.com / seed-password-customer
 */

import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main(): Promise<void> {
  // ── Organization ────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Golf Club',
      slug: 'demo-org',
      minLeaseMonths: 6,
    },
  });

  console.log(`✔ Organization: ${org.name} (${org.slug})`);

  // ── Location ─────────────────────────────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: 'seed-location-001' },
    update: {},
    create: {
      id: 'seed-location-001',
      organizationId: org.id,
      name: 'Main Depot',
      address: '1 Fairway Drive',
      timezone: 'UTC',
    },
  });

  console.log(`✔ Location: ${location.name}`);

  // ── Staff users ──────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'superadmin@demo-org.com' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Demo Super Admin',
      email: 'superadmin@demo-org.com',
      passwordHash: await hash('seed-password-superadmin'),
      role: 'super_admin',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'admin@demo-org.com' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Demo Admin',
      email: 'admin@demo-org.com',
      passwordHash: await hash('seed-password-admin'),
      role: 'org_admin',
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'staff@demo-org.com' } },
    update: {},
    create: {
      organizationId: org.id,
      locationId: location.id,
      name: 'Demo Staff',
      email: 'staff@demo-org.com',
      passwordHash: await hash('seed-password-staff'),
      role: 'staff',
    },
  });

  console.log(`✔ Users: ${superAdmin.email} (super_admin), ${adminUser.email} (org_admin), ${staffUser.email} (staff)`);

  // ── Customer ─────────────────────────────────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'customer@demo-org.com' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Demo Customer',
      email: 'customer@demo-org.com',
      phone: '+1-555-0100',
      passwordHash: await hash('seed-password-customer'),
    },
  });

  console.log(`✔ Customer: ${customer.email}`);

  // ── Cart type ─────────────────────────────────────────────────────────────────
  const cartType = await prisma.cartType.upsert({
    where: { id: 'seed-cart-type-001' },
    update: {},
    create: {
      id: 'seed-cart-type-001',
      organizationId: org.id,
      name: 'Standard 2-Seater',
      dailyRate: '45.00',
      monthlyRate: '800.00',
      seatingCapacity: 2,
    },
  });

  console.log(`✔ Cart type: ${cartType.name}`);

  // ── Carts ─────────────────────────────────────────────────────────────────────
  const cart = await prisma.cart.upsert({
    where: { id: 'seed-cart-001' },
    update: {},
    create: {
      id: 'seed-cart-001',
      organizationId: org.id,
      locationId: location.id,
      cartTypeId: cartType.id,
      label: 'GC-001',
      year: 2022,
      color: 'White',
      status: 'available',
    },
  });

  console.log(`✔ Cart: ${cart.label} (${cart.status})`);

  console.log('\n─────────────────────────────────────────');
  console.log('Seed complete. Test credentials:');
  console.log('  org slug   : demo-org');
  console.log('  super_admin: superadmin@demo-org.com / seed-password-superadmin');
  console.log('  org_admin  : admin@demo-org.com      / seed-password-admin');
  console.log('  staff      : staff@demo-org.com      / seed-password-staff');
  console.log('  customer   : customer@demo-org.com   / seed-password-customer');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

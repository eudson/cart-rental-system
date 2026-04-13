import 'reflect-metadata';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CartStatus } from 'shared';

import { VALID_CART_TRANSITIONS } from '../src/carts/constants/cart-status-transitions.constant';
import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../src/common/pagination/pagination.util';

// ---------------------------------------------------------------------------
// Pagination utilities
// ---------------------------------------------------------------------------

describe('buildPaginationMeta', () => {
  test('computes totalPages as ceil(totalItems / pageSize)', () => {
    const meta = buildPaginationMeta({ page: 1, pageSize: 10, totalItems: 25 });
    assert.equal(meta.totalPages, 3);
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 10);
    assert.equal(meta.totalItems, 25);
    assert.equal(meta.search, null);
  });

  test('totalPages is 0 when totalItems is 0', () => {
    const meta = buildPaginationMeta({ page: 1, pageSize: 20, totalItems: 0 });
    assert.equal(meta.totalPages, 0);
  });

  test('includes search when provided', () => {
    const meta = buildPaginationMeta({ page: 2, pageSize: 5, totalItems: 12, search: 'golf' });
    assert.equal(meta.search, 'golf');
    assert.equal(meta.totalPages, 3);
  });

  test('exact fit: totalItems divisible by pageSize gives no extra page', () => {
    const meta = buildPaginationMeta({ page: 1, pageSize: 5, totalItems: 20 });
    assert.equal(meta.totalPages, 4);
  });
});

describe('calculatePaginationOffset', () => {
  test('page 1 offset is 0', () => {
    assert.equal(calculatePaginationOffset(1, 20), 0);
  });

  test('page 2 offset equals pageSize', () => {
    assert.equal(calculatePaginationOffset(2, 20), 20);
  });

  test('page 3 offset equals 2 × pageSize', () => {
    assert.equal(calculatePaginationOffset(3, 10), 20);
  });
});

// ---------------------------------------------------------------------------
// Cart status transition rules
// ---------------------------------------------------------------------------

describe('VALID_CART_TRANSITIONS', () => {
  test('available can transition to reserved and retired only', () => {
    const allowed = VALID_CART_TRANSITIONS[CartStatus.available];
    assert.deepEqual([...allowed].sort(), [CartStatus.reserved, CartStatus.retired].sort());
  });

  test('reserved can transition to available and rented only', () => {
    const allowed = VALID_CART_TRANSITIONS[CartStatus.reserved];
    assert.deepEqual([...allowed].sort(), [CartStatus.available, CartStatus.rented].sort());
  });

  test('rented can transition to available and retired only', () => {
    const allowed = VALID_CART_TRANSITIONS[CartStatus.rented];
    assert.deepEqual([...allowed].sort(), [CartStatus.available, CartStatus.retired].sort());
  });

  test('retired has no allowed transitions (terminal state)', () => {
    const allowed = VALID_CART_TRANSITIONS[CartStatus.retired];
    assert.deepEqual(allowed, []);
  });

  test('every CartStatus value has an entry in the map', () => {
    for (const status of Object.values(CartStatus)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(VALID_CART_TRANSITIONS, status),
        `Missing transition entry for CartStatus.${status}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Outstanding balance formula (mirrors rentals.service.ts inline logic)
// The formula: outstandingBalance = round(max(0, totalAmount - paidTotal), 2 dp)
// ---------------------------------------------------------------------------

function computeOutstandingBalance(totalAmount: number, paidTotal: number): number {
  return Math.round(Math.max(0, totalAmount - paidTotal) * 100) / 100;
}

describe('outstanding balance calculation', () => {
  test('returns the unpaid portion when partially paid', () => {
    assert.equal(computeOutstandingBalance(200, 75), 125);
  });

  test('returns 0 when fully paid', () => {
    assert.equal(computeOutstandingBalance(200, 200), 0);
  });

  test('returns 0 when overpaid (never negative)', () => {
    assert.equal(computeOutstandingBalance(100, 150), 0);
  });

  test('rounds to 2 decimal places', () => {
    // 199.999 - 100 = 99.999 → rounds to 100.00
    assert.equal(computeOutstandingBalance(199.999, 100), 100);
  });

  test('returns full totalAmount when nothing is paid', () => {
    assert.equal(computeOutstandingBalance(350, 0), 350);
  });
});

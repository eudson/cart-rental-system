import { CartStatus } from 'shared';

export const VALID_CART_TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  [CartStatus.available]: [CartStatus.reserved, CartStatus.retired],
  [CartStatus.reserved]: [CartStatus.available, CartStatus.rented],
  [CartStatus.rented]: [CartStatus.available, CartStatus.retired],
  [CartStatus.retired]: [],
};

import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { RentalStatus } from '../enums/rental-status.enum';
import { RentalType } from '../enums/rental-type.enum';
import type { PaginationQueryDto } from './pagination.types';

export interface ListRentalsQueryDto extends PaginationQueryDto {
  type?: RentalType;
  status?: RentalStatus;
  customerId?: string;
  cartId?: string;
}

export interface ListRentalPaymentsQueryDto extends PaginationQueryDto {}

export interface CreateRentalPaymentRequestDto {
  amount: number;
  method: PaymentMethod;
  status?: PaymentStatus;
  paidAt?: string;
  notes?: string;
}

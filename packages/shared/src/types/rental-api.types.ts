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
  startDateFrom?: string;
  endDateTo?: string;
}

export interface CreateRentalRequestDto {
  type: RentalType;
  customerId: string;
  cartId: string;
  startDate: string;
  endDate?: string;
  contractMonths?: number;
  notes?: string;
}

export interface ListRentalPaymentsQueryDto extends PaginationQueryDto {}

export interface CreateRentalPaymentRequestDto {
  amount: number;
  method: PaymentMethod;
  status?: PaymentStatus;
  paidAt?: string;
  notes?: string;
}

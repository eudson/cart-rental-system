import { CartStatus } from '../enums/cart-status.enum';
import { RentalType } from '../enums/rental-type.enum';
import type { PaginationQueryDto } from './pagination.types';

export interface ListCartsQueryDto extends PaginationQueryDto {
  locationId?: string;
  status?: CartStatus;
}

export interface CreateCartRequestDto {
  locationId: string;
  cartTypeId: string;
  label: string;
  year?: number;
  color?: string;
  notes?: string;
  status?: CartStatus;
}

export interface ListCartAvailabilityQueryDto {
  startDate: string;
  endDate: string;
  locationId?: string;
  type: RentalType;
}

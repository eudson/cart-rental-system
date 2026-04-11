import { CartStatus } from '../enums/cart-status.enum';
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

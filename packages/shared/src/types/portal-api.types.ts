import { RentalStatus } from '../enums/rental-status.enum';
import { RentalType } from '../enums/rental-type.enum';
import type { PaginationQueryDto } from './pagination.types';

export interface ListPortalRentalsQueryDto extends PaginationQueryDto {
  type?: RentalType;
  status?: RentalStatus;
}

import type { PaginationQueryDto } from './pagination.types';

export interface ListCustomersQueryDto extends PaginationQueryDto {}

export interface CreateCustomerRequestDto {
  name: string;
  email: string;
  phone?: string;
  idNumber?: string;
  password: string;
}

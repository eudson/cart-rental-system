import type {
  CreateCustomerRequestDto,
  Customer,
  ListCustomersQueryDto,
  PaginationMeta,
} from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListCustomersResponse {
  customers: Customer[];
  pagination: PaginationMeta;
}

export async function listCustomers(
  query: ListCustomersQueryDto,
): Promise<ListCustomersResponse> {
  const response = await apiRequestWithMeta<Customer[]>(
    `/customers${buildQueryString(query)}`,
  );

  return {
    customers: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function createCustomer(dto: CreateCustomerRequestDto): Promise<Customer> {
  return apiRequest<Customer, CreateCustomerRequestDto>('/customers', {
    method: 'POST',
    body: dto,
  });
}

export async function getCustomerById(customerId: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${customerId}`);
}

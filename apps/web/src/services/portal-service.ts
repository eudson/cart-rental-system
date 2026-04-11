import type {
  Customer,
  LeaseContract,
  ListPortalRentalsQueryDto,
  Payment,
  PaginationMeta,
  PaginationQueryDto,
  Rental,
} from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListPortalRentalsResponse {
  rentals: Rental[];
  pagination: PaginationMeta;
}

interface ListPortalPaymentsResponse {
  payments: Payment[];
  pagination: PaginationMeta;
}

export async function getPortalProfile(): Promise<Customer> {
  return apiRequest<Customer>('/portal/me');
}

export async function listPortalRentals(
  query: ListPortalRentalsQueryDto,
): Promise<ListPortalRentalsResponse> {
  const response = await apiRequestWithMeta<Rental[]>(
    `/portal/rentals${buildQueryString(query)}`,
  );

  return {
    rentals: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function getPortalRentalById(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/portal/rentals/${rentalId}`);
}

export async function getPortalRentalContract(rentalId: string): Promise<LeaseContract> {
  return apiRequest<LeaseContract>(`/portal/rentals/${rentalId}/contract`);
}

export async function listPortalRentalPayments(
  rentalId: string,
  query: PaginationQueryDto,
): Promise<ListPortalPaymentsResponse> {
  const response = await apiRequestWithMeta<Payment[]>(
    `/portal/rentals/${rentalId}/payments${buildQueryString(query)}`,
  );

  return {
    payments: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

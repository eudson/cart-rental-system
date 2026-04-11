import type {
  CreateRentalPaymentRequestDto,
  Payment,
  PaginationMeta,
  Rental,
  ListRentalPaymentsQueryDto,
  ListRentalsQueryDto,
} from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListRentalsResponse {
  rentals: Rental[];
  pagination: PaginationMeta;
}

interface ListRentalPaymentsResponse {
  payments: Payment[];
  pagination: PaginationMeta;
}

export async function listRentals(query: ListRentalsQueryDto): Promise<ListRentalsResponse> {
  const response = await apiRequestWithMeta<Rental[]>(`/rentals${buildQueryString(query)}`);

  return {
    rentals: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function getRentalById(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/rentals/${rentalId}`);
}

export async function listRentalPayments(
  rentalId: string,
  query: ListRentalPaymentsQueryDto,
): Promise<ListRentalPaymentsResponse> {
  const response = await apiRequestWithMeta<Payment[]>(
    `/rentals/${rentalId}/payments${buildQueryString(query)}`,
  );

  return {
    payments: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function createRentalPayment(
  rentalId: string,
  dto: CreateRentalPaymentRequestDto,
): Promise<Payment> {
  return apiRequest<Payment, CreateRentalPaymentRequestDto>(`/rentals/${rentalId}/payments`, {
    method: 'POST',
    body: dto,
  });
}

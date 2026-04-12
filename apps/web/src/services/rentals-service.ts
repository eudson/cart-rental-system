import type {
  CreateRentalRequestDto,
  CreateRentalPaymentRequestDto,
  LeaseContract,
  Payment,
  PaginationMeta,
  Rental,
  RentalListItem,
  ListRentalPaymentsQueryDto,
  ListRentalsQueryDto,
} from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListRentalsResponse {
  rentals: RentalListItem[];
  pagination: PaginationMeta;
}

interface ListRentalPaymentsResponse {
  payments: Payment[];
  pagination: PaginationMeta;
}

export async function listRentals(query: ListRentalsQueryDto): Promise<ListRentalsResponse> {
  const response = await apiRequestWithMeta<RentalListItem[]>(`/rentals${buildQueryString(query)}`);

  return {
    rentals: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function getRentalById(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/rentals/${rentalId}`);
}

export async function createRental(dto: CreateRentalRequestDto): Promise<Rental> {
  return apiRequest<Rental, CreateRentalRequestDto>('/rentals', {
    method: 'POST',
    body: dto,
  });
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

export async function checkoutRental(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/rentals/${rentalId}/checkout`, { method: 'POST' });
}

export async function checkinRental(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/rentals/${rentalId}/checkin`, { method: 'POST' });
}

export async function cancelRental(rentalId: string): Promise<Rental> {
  return apiRequest<Rental>(`/rentals/${rentalId}/cancel`, { method: 'POST' });
}

export async function getRentalContract(rentalId: string): Promise<LeaseContract> {
  return apiRequest<LeaseContract>(`/rentals/${rentalId}/contract`);
}

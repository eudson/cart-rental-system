import type { CartType, PaginationMeta, PaginationQueryDto } from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListCartTypesResponse {
  cartTypes: CartType[];
  pagination: PaginationMeta;
}

export async function listCartTypes(
  query: PaginationQueryDto,
): Promise<ListCartTypesResponse> {
  const response = await apiRequestWithMeta<CartType[]>(
    `/cart-types${buildQueryString(query)}`,
  );

  return {
    cartTypes: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export interface CreateCartTypeBody {
  name: string;
  description?: string;
  dailyRate: number;
  monthlyRate: number;
  seatingCapacity?: number;
}

export async function createCartType(body: CreateCartTypeBody): Promise<CartType> {
  return apiRequest<CartType, CreateCartTypeBody>('/cart-types', {
    method: 'POST',
    body,
  });
}

export interface UpdateCartTypeBody {
  name?: string;
  description?: string;
  dailyRate?: number;
  monthlyRate?: number;
  seatingCapacity?: number;
}

export async function updateCartType(
  cartTypeId: string,
  body: UpdateCartTypeBody,
): Promise<CartType> {
  return apiRequest<CartType, UpdateCartTypeBody>(`/cart-types/${cartTypeId}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteCartType(cartTypeId: string): Promise<void> {
  await apiRequest<void>(`/cart-types/${cartTypeId}`, { method: 'DELETE' });
}

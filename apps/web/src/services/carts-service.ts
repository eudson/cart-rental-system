import type {
  Cart,
  CreateCartRequestDto,
  ListCartsQueryDto,
  PaginationMeta,
} from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListCartsResponse {
  carts: Cart[];
  pagination: PaginationMeta;
}

export async function listCarts(query: ListCartsQueryDto): Promise<ListCartsResponse> {
  const response = await apiRequestWithMeta<Cart[]>(`/carts${buildQueryString(query)}`);

  return {
    carts: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export async function createCart(dto: CreateCartRequestDto): Promise<Cart> {
  return apiRequest<Cart, CreateCartRequestDto>('/carts', {
    method: 'POST',
    body: dto,
  });
}

export async function getCartById(cartId: string): Promise<Cart> {
  return apiRequest<Cart>(`/carts/${cartId}`);
}

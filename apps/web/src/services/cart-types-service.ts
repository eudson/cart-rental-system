import type { CartType, PaginationMeta, PaginationQueryDto } from 'shared';
import { apiRequestWithMeta, buildQueryString } from '@/services/api-client';
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

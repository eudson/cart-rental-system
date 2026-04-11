import type { Location, PaginationMeta, PaginationQueryDto } from 'shared';
import { apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListLocationsResponse {
  locations: Location[];
  pagination: PaginationMeta;
}

export async function listLocations(
  query: PaginationQueryDto,
): Promise<ListLocationsResponse> {
  const response = await apiRequestWithMeta<Location[]>(
    `/locations${buildQueryString(query)}`,
  );

  return {
    locations: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

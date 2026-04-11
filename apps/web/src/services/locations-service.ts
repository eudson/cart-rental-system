import type { Location, PaginationMeta, PaginationQueryDto } from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
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

export interface CreateLocationBody {
  name: string;
  address?: string;
  timezone?: string;
}

export async function createLocation(body: CreateLocationBody): Promise<Location> {
  return apiRequest<Location, CreateLocationBody>('/locations', {
    method: 'POST',
    body,
  });
}

export interface UpdateLocationBody {
  name?: string;
  address?: string;
  timezone?: string;
}

export async function updateLocation(
  locationId: string,
  body: UpdateLocationBody,
): Promise<Location> {
  return apiRequest<Location, UpdateLocationBody>(`/locations/${locationId}`, {
    method: 'PATCH',
    body,
  });
}

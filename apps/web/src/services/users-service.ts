import type { PaginationMeta, PaginationQueryDto, User } from 'shared';
import { apiRequest, apiRequestWithMeta, buildQueryString } from '@/services/api-client';
import { getPaginationMeta } from '@/services/pagination-service';

interface ListUsersResponse {
  users: User[];
  pagination: PaginationMeta;
}

export async function listUsers(query: PaginationQueryDto): Promise<ListUsersResponse> {
  const response = await apiRequestWithMeta<User[]>(`/users${buildQueryString(query)}`);

  return {
    users: response.data,
    pagination: getPaginationMeta(response.meta),
  };
}

export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: 'org_admin' | 'staff';
  locationId?: string;
}

export async function createUser(body: CreateUserBody): Promise<User> {
  return apiRequest<User, CreateUserBody>('/users', { method: 'POST', body });
}

export interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: 'org_admin' | 'staff';
  locationId?: string;
}

export async function updateUser(userId: string, body: UpdateUserBody): Promise<User> {
  return apiRequest<User, UpdateUserBody>(`/users/${userId}`, { method: 'PATCH', body });
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiRequest<void>(`/users/${userId}`, { method: 'DELETE' });
}

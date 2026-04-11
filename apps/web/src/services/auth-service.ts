import type {
  AuthTokensResponseDto,
  LoginRequestDto,
  RefreshRequestDto,
  RefreshResponseDto,
} from 'shared';
import { apiRequest } from '@/services/api-client';

export async function loginStaff(dto: LoginRequestDto): Promise<AuthTokensResponseDto> {
  return apiRequest<AuthTokensResponseDto, LoginRequestDto>('/auth/login', {
    method: 'POST',
    body: dto,
  });
}

export async function loginCustomer(dto: LoginRequestDto): Promise<AuthTokensResponseDto> {
  return apiRequest<AuthTokensResponseDto, LoginRequestDto>('/auth/customer/login', {
    method: 'POST',
    body: dto,
  });
}

export async function refreshAccessToken(
  dto: RefreshRequestDto,
): Promise<RefreshResponseDto> {
  return apiRequest<RefreshResponseDto, RefreshRequestDto>('/auth/refresh', {
    method: 'POST',
    body: dto,
  });
}

export async function logoutStaffSession(): Promise<void> {
  return apiRequest<void, undefined>('/auth/logout', {
    method: 'POST',
  });
}

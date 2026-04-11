import { UserRole } from '../enums/roles.enum';

export interface LoginRequestDto {
  email: string;
  password: string;
  organizationSlug: string;
}

export interface AuthTokensResponseDto {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface RefreshResponseDto {
  accessToken: string;
}

export type SessionRole = UserRole | 'customer';

export interface AccessTokenClaimsDto {
  sub: string;
  organizationId: string;
  role: SessionRole;
  iat: number;
  exp: number;
}

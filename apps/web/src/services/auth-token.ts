import { UserRole, type AccessTokenClaimsDto } from 'shared';

function decodeBase64Url(value: string): string {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalizedValue.length % 4;
  const paddedValue =
    padding === 0 ? normalizedValue : `${normalizedValue}${'='.repeat(4 - padding)}`;

  return atob(paddedValue);
}

function isValidSessionRole(value: unknown): value is AccessTokenClaimsDto['role'] {
  return value === 'customer' || Object.values(UserRole).includes(value as UserRole);
}

export function parseAccessTokenClaims(accessToken: string): AccessTokenClaimsDto | null {
  const tokenParts = accessToken.split('.');
  if (tokenParts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(tokenParts[1])) as Partial<AccessTokenClaimsDto>;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.organizationId !== 'string' ||
      !isValidSessionRole(payload.role) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from 'shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { StaffRequestUser } from '../../common/interfaces/request-user.interface';
import type { StaffJwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'fallback-secret',
    });
  }

  validate(payload: StaffJwtPayload): StaffRequestUser {
    if (!payload.sub || !payload.organizationId || !payload.role) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing or invalid JWT' });
    }
    return {
      userId: payload.sub,
      organizationId: payload.organizationId,
      // Role in the token is a plain string; cast to the shared enum since values are identical
      role: payload.role as UserRole,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { CustomerRequestUser } from '../../common/interfaces/request-user.interface';
import type { CustomerJwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'fallback-secret',
    });
  }

  validate(payload: CustomerJwtPayload): CustomerRequestUser {
    if (!payload.sub || !payload.organizationId || payload.role !== 'customer') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing or invalid JWT' });
    }
    return {
      customerId: payload.sub,
      organizationId: payload.organizationId,
      role: 'customer',
    };
  }
}

import * as bcrypt from 'bcrypt';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { CustomerJwtPayload, StaffJwtPayload } from './interfaces/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;

// process.env values for token TTLs are valid ms-format strings at runtime.
// Cast is safe because these values come from .env and are validated by the operator.
function jwtOptions(secret: string | undefined, expiresIn: string): JwtSignOptions {
  return {
    secret: secret ?? 'fallback-secret',
    expiresIn: expiresIn as JwtSignOptions['expiresIn'],
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    this.logger.log(`Staff login attempt — email=${dto.email} slug=${dto.organizationSlug}`);

    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (!org) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const user = await this.prisma.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: dto.email } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const payload: StaffJwtPayload = {
      sub: user.id,
      organizationId: org.id,
      role: user.role,
    };

    return this.issueTokens(payload, 'user', user.id);
  }

  async customerLogin(dto: LoginDto): Promise<AuthTokens> {
    this.logger.log(`Customer login attempt — email=${dto.email} slug=${dto.organizationSlug}`);

    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (!org) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: dto.email } },
    });
    if (!customer || !customer.isActive) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const payload: CustomerJwtPayload = {
      sub: customer.id,
      organizationId: org.id,
      role: 'customer',
    };

    return this.issueTokens(payload, 'customer', customer.id);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: StaffJwtPayload | CustomerJwtPayload;

    try {
      payload = this.jwtService.verify<StaffJwtPayload | CustomerJwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    }

    const isCustomer = payload.role === 'customer';

    if (isCustomer) {
      const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
      if (!customer?.refreshTokenHash || !customer.isActive) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
      }
      const tokenValid = await bcrypt.compare(refreshToken, customer.refreshTokenHash);
      if (!tokenValid) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
      }
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.refreshTokenHash || !user.isActive) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
      }
      const tokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!tokenValid) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
      }
    }

    // Issue a fresh access token only; the refresh token stays valid until next full login
    const { sub, organizationId, role } = payload;
    const accessToken = this.jwtService.sign(
      { sub, organizationId, role },
      jwtOptions(process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN ?? '15m'),
    );

    return { accessToken };
  }

  async logout(userId: string): Promise<void> {
    this.logger.log(`Staff logout — userId=${userId}`);
    // updateMany avoids a P2025 throw when the token's sub no longer matches a
    // DB row (e.g. after a DB reset). If the user is already gone, logout succeeds.
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async issueTokens(
    payload: StaffJwtPayload | CustomerJwtPayload,
    entityType: 'user' | 'customer',
    entityId: string,
  ): Promise<AuthTokens> {
    const { sub, organizationId, role } = payload;

    const accessToken = this.jwtService.sign(
      { sub, organizationId, role },
      jwtOptions(process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN ?? '15m'),
    );

    const refreshToken = this.jwtService.sign(
      { sub, organizationId, role },
      jwtOptions(process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

    if (entityType === 'user') {
      await this.prisma.user.update({ where: { id: entityId }, data: { refreshTokenHash } });
    } else {
      await this.prisma.customer.update({ where: { id: entityId }, data: { refreshTokenHash } });
    }

    return { accessToken, refreshToken };
  }
}

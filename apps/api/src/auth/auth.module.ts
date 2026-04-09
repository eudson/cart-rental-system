import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // JwtModule registered with no defaults — secrets are always passed explicitly
    // at call sites so they can differ between access and refresh tokens.
    JwtModule.register({}),
  ],
  providers: [AuthService, JwtStrategy, CustomerJwtStrategy],
  controllers: [AuthController],
  exports: [JwtStrategy, CustomerJwtStrategy],
})
export class AuthModule {}

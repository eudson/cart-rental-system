import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CartTypesModule } from './cart-types/cart-types.module';
import { CartsModule } from './carts/carts.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LocationsModule } from './locations/locations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RentalsModule } from './rentals/rentals.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    LocationsModule,
    UsersModule,
    CustomersModule,
    CartTypesModule,
    CartsModule,
    DashboardModule,
    RentalsModule,
  ],
})
export class AppModule {}

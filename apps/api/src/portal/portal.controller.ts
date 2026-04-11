import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerJwtGuard } from '../common/guards/customer-jwt.guard';
import { OrgGuard } from '../common/guards/org.guard';
import type { CustomerRequestUser } from '../common/interfaces/request-user.interface';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { withResponseMeta } from '../common/interceptors/response-meta.util';
import { ListPortalRentalsQueryDto } from './dto/list-portal-rentals-query.dto';
import { PortalService } from './portal.service';

@Controller('portal')
@UseGuards(CustomerJwtGuard, OrgGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('me')
  getProfile(@CurrentUser() user: CustomerRequestUser) {
    return this.portalService.getCustomerProfile(user.customerId, user.organizationId);
  }

  @Get('rentals')
  async listRentals(
    @CurrentUser() user: CustomerRequestUser,
    @Query() query: ListPortalRentalsQueryDto,
  ) {
    const result = await this.portalService.listCustomerRentals(
      user.customerId,
      user.organizationId,
      query,
    );

    return withResponseMeta(result.rentals, { pagination: result.pagination });
  }

  @Get('rentals/:id')
  getRental(@CurrentUser() user: CustomerRequestUser, @Param('id') rentalId: string) {
    return this.portalService.getCustomerRental(
      user.customerId,
      user.organizationId,
      rentalId,
    );
  }

  @Get('rentals/:id/contract')
  getRentalContract(
    @CurrentUser() user: CustomerRequestUser,
    @Param('id') rentalId: string,
  ) {
    return this.portalService.getRentalContract(
      user.customerId,
      user.organizationId,
      rentalId,
    );
  }

  @Get('rentals/:id/payments')
  async getRentalPayments(
    @CurrentUser() user: CustomerRequestUser,
    @Param('id') rentalId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.portalService.listRentalPayments(
      user.customerId,
      user.organizationId,
      rentalId,
      query.page,
      query.pageSize,
    );

    return withResponseMeta(result.payments, { pagination: result.pagination });
  }
}

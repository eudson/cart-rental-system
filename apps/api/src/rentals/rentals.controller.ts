import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { UserRole } from 'shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { StaffRequestUser } from '../common/interfaces/request-user.interface';
import { withResponseMeta } from '../common/interceptors/response-meta.util';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ListRentalsQueryDto } from './dto/list-rentals-query.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { RentalsService } from './rentals.service';

@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listRentals(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListRentalsQueryDto,
  ) {
    const result = await this.rentalsService.listRentals(user.organizationId, query);
    return withResponseMeta(result.rentals, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.CREATED)
  createRental(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateRentalDto,
  ) {
    return this.rentalsService.createRental(user.organizationId, user.userId, dto);
  }

  @Post(':id/checkout')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.OK)
  checkoutRental(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
  ) {
    return this.rentalsService.checkoutRental(user.organizationId, rentalId);
  }

  @Post(':id/checkin')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.OK)
  checkinRental(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
  ) {
    return this.rentalsService.checkinRental(user.organizationId, rentalId);
  }

  @Post(':id/cancel')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.OK)
  cancelRental(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
  ) {
    return this.rentalsService.cancelRental(user.organizationId, rentalId);
  }

  @Post(':id/contract')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.CREATED)
  createLeaseContract(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateLeaseContractDto,
  ) {
    return this.rentalsService.createLeaseContract(user.organizationId, rentalId, dto);
  }

  @Patch(':id/contract')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  updateLeaseContract(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateLeaseContractDto,
  ) {
    return this.rentalsService.updateLeaseContract(user.organizationId, rentalId, dto);
  }

  @Get(':id/contract')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getLeaseContract(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
  ) {
    return this.rentalsService.getLeaseContract(user.organizationId, rentalId);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getRentalById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
  ) {
    return this.rentalsService.getRentalById(user.organizationId, rentalId);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  updateRental(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) rentalId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateRentalDto,
  ) {
    return this.rentalsService.updateRental(user.organizationId, rentalId, dto);
  }
}

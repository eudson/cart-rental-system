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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listCustomers(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListCustomersQueryDto,
  ) {
    const result = await this.customersService.listCustomers(user.organizationId, query);

    return withResponseMeta(result.customers, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  @HttpCode(HttpStatus.CREATED)
  createCustomer(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(user.organizationId, dto);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getCustomerById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.customersService.getCustomerById(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  updateCustomer(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(user.organizationId, id, dto);
  }
}

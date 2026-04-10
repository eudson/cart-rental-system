import {
  Body,
  Controller,
  Delete,
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
import { CartTypesService } from './cart-types.service';
import { CreateCartTypeDto } from './dto/create-cart-type.dto';
import { ListCartTypesQueryDto } from './dto/list-cart-types-query.dto';
import { UpdateCartTypeDto } from './dto/update-cart-type.dto';

@Controller('cart-types')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class CartTypesController {
  constructor(private readonly cartTypesService: CartTypesService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listCartTypes(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListCartTypesQueryDto,
  ) {
    const result = await this.cartTypesService.listCartTypes(user.organizationId, query);

    return withResponseMeta(result.cartTypes, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.org_admin)
  @HttpCode(HttpStatus.CREATED)
  createCartType(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCartTypeDto,
  ) {
    return this.cartTypesService.createCartType(user.organizationId, dto);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getCartTypeById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.cartTypesService.getCartTypeById(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin)
  updateCartType(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCartTypeDto,
  ) {
    return this.cartTypesService.updateCartType(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin)
  @HttpCode(HttpStatus.OK)
  deleteCartType(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.cartTypesService.deleteCartType(user.organizationId, id);
  }
}

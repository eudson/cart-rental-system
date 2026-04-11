import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CartsService } from './carts.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { ListCartAvailabilityQueryDto } from './dto/list-cart-availability-query.dto';
import { ListCartsQueryDto } from './dto/list-carts-query.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('carts')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listCarts(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListCartsQueryDto,
  ) {
    const result = await this.cartsService.listCarts(user.organizationId, query);

    return withResponseMeta(result.carts, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.org_admin)
  @HttpCode(HttpStatus.CREATED)
  createCart(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCartDto,
  ) {
    return this.cartsService.createCart(user.organizationId, dto);
  }

  @Get('availability')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  listCartAvailability(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListCartAvailabilityQueryDto,
  ) {
    return this.cartsService.listAvailableCarts(user.organizationId, query);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getCartById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id') id: string,
  ) {
    return this.cartsService.getCartById(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  updateCart(
    @CurrentUser() user: StaffRequestUser,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCartDto,
  ) {
    if (user.role === UserRole.staff) {
      const hasNonStatusField =
        dto.locationId !== undefined ||
        dto.cartTypeId !== undefined ||
        dto.label !== undefined ||
        dto.year !== undefined ||
        dto.color !== undefined ||
        dto.notes !== undefined;

      if (hasNonStatusField || dto.status === undefined) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Staff can only update cart status',
        });
      }

      return this.cartsService.updateCartStatus(user.organizationId, id, dto.status);
    }

    return this.cartsService.updateCart(user.organizationId, id, dto);
  }
}

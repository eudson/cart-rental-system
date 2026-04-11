import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { CreateRentalDto } from './dto/create-rental.dto';
import { RentalsService } from './rentals.service';

@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

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
}

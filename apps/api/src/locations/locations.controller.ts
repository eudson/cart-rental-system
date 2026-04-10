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
import { CreateLocationDto } from './dto/create-location.dto';
import { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listLocations(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListLocationsQueryDto,
  ) {
    const result = await this.locationsService.listLocations(user.organizationId, query);

    return withResponseMeta(result.locations, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.org_admin)
  @HttpCode(HttpStatus.CREATED)
  createLocation(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateLocationDto,
  ) {
    return this.locationsService.createLocation(user.organizationId, dto);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getLocationById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.locationsService.getLocationById(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin)
  updateLocation(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateLocationDto,
  ) {
    return this.locationsService.updateLocation(user.organizationId, id, dto);
  }
}

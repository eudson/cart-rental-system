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

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { withResponseMeta } from '../common/interceptors/response-meta.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.super_admin)
  @HttpCode(HttpStatus.CREATED)
  createOrganization(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(dto);
  }

  @Get()
  @Roles(UserRole.super_admin)
  async listOrganizations(
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListOrganizationsQueryDto,
  ) {
    const result = await this.organizationsService.listOrganizations(query);

    return withResponseMeta(result.organizations, {
      pagination: result.pagination,
    });
  }

  @Get(':id')
  @Roles(UserRole.super_admin)
  getOrganizationById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.organizationsService.getOrganizationById(id);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin)
  updateOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(id, dto);
  }
}

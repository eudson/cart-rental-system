import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { UserRole } from 'shared';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { withResponseMeta } from '../common/interceptors/response-meta.util';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

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
}

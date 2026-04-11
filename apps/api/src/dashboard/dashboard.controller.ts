import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from 'shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { StaffRequestUser } from '../common/interfaces/request-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getOverview(@CurrentUser() user: StaffRequestUser) {
    return this.dashboardService.getOverview(user.organizationId);
  }
}
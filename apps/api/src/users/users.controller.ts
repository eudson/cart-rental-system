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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, OrgGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  async listUsers(
    @CurrentUser() user: StaffRequestUser,
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ListUsersQueryDto,
  ) {
    const result = await this.usersService.listUsers(user.organizationId, query);

    return withResponseMeta(result.users, {
      pagination: result.pagination,
    });
  }

  @Post()
  @Roles(UserRole.org_admin)
  @HttpCode(HttpStatus.CREATED)
  createUser(
    @CurrentUser() user: StaffRequestUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateUserDto,
  ) {
    return this.usersService.createUser(user.organizationId, dto);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.org_admin, UserRole.staff)
  getUserById(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.usersService.getUserById(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.org_admin)
  updateUser(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.org_admin)
  @HttpCode(HttpStatus.OK)
  softDeleteUser(
    @CurrentUser() user: StaffRequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.usersService.softDeleteUser(user.organizationId, id);
  }
}

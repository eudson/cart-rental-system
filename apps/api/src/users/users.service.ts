import * as bcrypt from 'bcrypt';

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

const USER_PUBLIC_SELECT = {
  id: true,
  organizationId: true,
  locationId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(organizationId: string, query: ListUsersQueryDto): Promise<{
    users: Array<{
      id: string;
      organizationId: string;
      locationId: string | null;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildSearchWhere(organizationId, normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { name: 'asc' },
        select: USER_PUBLIC_SELECT,
      }),
    ]);

    return {
      users,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  async createUser(organizationId: string, dto: CreateUserDto) {
    if (dto.locationId) {
      await this.findLocationOrThrow(organizationId, dto.locationId);
    }

    this.logger.log(
      `User create initiated — org=${organizationId} email=${dto.email} role=${dto.role}`,
    );

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          organizationId,
          locationId: dto.locationId,
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
        },
        select: USER_PUBLIC_SELECT,
      });
    } catch (error) {
      if (this.isDuplicateEmailConflict(error)) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'User email already exists in this organization',
        });
      }
      throw error;
    }
  }

  async getUserById(organizationId: string, userId: string) {
    return this.findUserOrThrow(organizationId, userId);
  }

  async updateUser(organizationId: string, userId: string, dto: UpdateUserDto) {
    await this.findUserOrThrow(organizationId, userId);

    if (dto.locationId) {
      await this.findLocationOrThrow(organizationId, dto.locationId);
    }

    this.logger.log(`User update initiated — org=${organizationId} userId=${userId}`);

    const data: Prisma.UserUpdateInput = {
      location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
      name: dto.name,
      email: dto.email,
      role: dto.role,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: USER_PUBLIC_SELECT,
      });
    } catch (error) {
      if (this.isDuplicateEmailConflict(error)) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'User email already exists in this organization',
        });
      }
      throw error;
    }
  }

  async softDeleteUser(organizationId: string, userId: string) {
    await this.findUserOrThrow(organizationId, userId);

    this.logger.log(`User soft delete initiated — org=${organizationId} userId=${userId}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: USER_PUBLIC_SELECT,
    });
  }

  private buildSearchWhere(
    organizationId: string,
    search?: string,
  ): Prisma.UserWhereInput {
    if (!search) {
      return { organizationId };
    }

    return {
      organizationId,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async findUserOrThrow(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return user;
  }

  private async findLocationOrThrow(organizationId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
      select: { id: true },
    });

    if (!location) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Location not found' });
    }
  }

  private isDuplicateEmailConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    if (!Array.isArray(error.meta?.target)) {
      return false;
    }

    return (
      (error.meta.target.includes('organizationId') ||
        error.meta.target.includes('organization_id')) &&
      error.meta.target.includes('email')
    );
  }
}

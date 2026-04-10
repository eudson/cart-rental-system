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
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(dto: CreateOrganizationDto) {
    this.logger.log(`Organization create initiated — slug=${dto.slug}`);

    try {
      return await this.prisma.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          status: dto.status,
          minLeaseMonths: dto.minLeaseMonths,
          defaultDailyRate: dto.defaultDailyRate,
          defaultMonthlyRate: dto.defaultMonthlyRate,
        },
      });
    } catch (error) {
      if (this.isUniqueSlugConflict(error)) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Organization slug already exists',
        });
      }
      throw error;
    }
  }

  async listOrganizations(query: ListOrganizationsQueryDto): Promise<{
    organizations: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      minLeaseMonths: number;
      defaultDailyRate: Prisma.Decimal | null;
      defaultMonthlyRate: Prisma.Decimal | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildSearchWhere(normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    this.logger.log(
      `Organizations list requested — page=${query.page} pageSize=${query.pageSize} search=${normalizedSearch ?? 'none'}`,
    );

    // Super-admin organization listing is intentionally platform-scoped.
    // No organizationId filter is applied because this endpoint must return all tenants.
    const [totalItems, organizations] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      organizations,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  async getOrganizationById(id: string) {
    return this.findOrganizationOrThrow(id);
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    await this.findOrganizationOrThrow(id);

    this.logger.log(`Organization update initiated — id=${id}`);

    try {
      return await this.prisma.organization.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          status: dto.status,
          minLeaseMonths: dto.minLeaseMonths,
          defaultDailyRate: dto.defaultDailyRate,
          defaultMonthlyRate: dto.defaultMonthlyRate,
        },
      });
    } catch (error) {
      if (this.isUniqueSlugConflict(error)) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Organization slug already exists',
        });
      }
      throw error;
    }
  }

  private buildSearchWhere(search?: string): Prisma.OrganizationWhereInput | undefined {
    if (!search) {
      return undefined;
    }

    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async findOrganizationOrThrow(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    return organization;
  }

  private isUniqueSlugConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    if (!Array.isArray(error.meta?.target)) {
      return false;
    }

    return error.meta.target.includes('slug');
  }
}

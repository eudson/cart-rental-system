import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}

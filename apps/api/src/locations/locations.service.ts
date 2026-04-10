import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listLocations(organizationId: string, query: ListLocationsQueryDto): Promise<{
    locations: Array<{
      id: string;
      organizationId: string;
      name: string;
      address: string | null;
      timezone: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildSearchWhere(organizationId, normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, locations] = await this.prisma.$transaction([
      this.prisma.location.count({ where }),
      this.prisma.location.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      locations,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  createLocation(organizationId: string, dto: CreateLocationDto) {
    this.logger.log(`Location create initiated — org=${organizationId} name=${dto.name}`);

    return this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone,
        status: dto.status,
      },
    });
  }

  async getLocationById(organizationId: string, locationId: string) {
    return this.findLocationOrThrow(organizationId, locationId);
  }

  async updateLocation(organizationId: string, locationId: string, dto: UpdateLocationDto) {
    await this.findLocationOrThrow(organizationId, locationId);

    this.logger.log(`Location update initiated — org=${organizationId} locationId=${locationId}`);

    return this.prisma.location.update({
      where: { id: locationId },
      data: {
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone,
        status: dto.status,
      },
    });
  }

  private buildSearchWhere(
    organizationId: string,
    search?: string,
  ): Prisma.LocationWhereInput {
    if (!search) {
      return { organizationId };
    }

    return {
      organizationId,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { timezone: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async findLocationOrThrow(organizationId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    return location;
  }
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCartTypeDto } from './dto/create-cart-type.dto';
import type { ListCartTypesQueryDto } from './dto/list-cart-types-query.dto';
import type { UpdateCartTypeDto } from './dto/update-cart-type.dto';

@Injectable()
export class CartTypesService {
  private readonly logger = new Logger(CartTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCartTypes(organizationId: string, query: ListCartTypesQueryDto): Promise<{
    cartTypes: Array<{
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      dailyRate: Prisma.Decimal;
      monthlyRate: Prisma.Decimal;
      seatingCapacity: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildSearchWhere(organizationId, normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, cartTypes] = await this.prisma.$transaction([
      this.prisma.cartType.count({ where }),
      this.prisma.cartType.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      cartTypes,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  createCartType(organizationId: string, dto: CreateCartTypeDto) {
    this.logger.log(`Cart type create initiated — org=${organizationId} name=${dto.name}`);

    return this.prisma.cartType.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        dailyRate: dto.dailyRate,
        monthlyRate: dto.monthlyRate,
        seatingCapacity: dto.seatingCapacity,
      },
    });
  }

  async getCartTypeById(organizationId: string, cartTypeId: string) {
    return this.findCartTypeOrThrow(organizationId, cartTypeId);
  }

  async updateCartType(organizationId: string, cartTypeId: string, dto: UpdateCartTypeDto) {
    await this.findCartTypeOrThrow(organizationId, cartTypeId);

    this.logger.log(`Cart type update initiated — org=${organizationId} cartTypeId=${cartTypeId}`);

    return this.prisma.cartType.update({
      where: { id: cartTypeId },
      data: {
        name: dto.name,
        description: dto.description,
        dailyRate: dto.dailyRate,
        monthlyRate: dto.monthlyRate,
        seatingCapacity: dto.seatingCapacity,
      },
    });
  }

  async deleteCartType(organizationId: string, cartTypeId: string) {
    await this.findCartTypeOrThrow(organizationId, cartTypeId);

    const assignedCarts = await this.prisma.cart.count({
      where: {
        organizationId,
        cartTypeId,
      },
    });

    if (assignedCarts > 0) {
      throw new ConflictException({
        code: 'CART_TYPE_IN_USE',
        message: 'Cannot delete cart type with assigned carts',
      });
    }

    this.logger.log(`Cart type delete initiated — org=${organizationId} cartTypeId=${cartTypeId}`);

    return this.prisma.cartType.delete({
      where: { id: cartTypeId },
    });
  }

  private buildSearchWhere(
    organizationId: string,
    search?: string,
  ): Prisma.CartTypeWhereInput {
    if (!search) {
      return { organizationId };
    }

    return {
      organizationId,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async findCartTypeOrThrow(organizationId: string, cartTypeId: string) {
    const cartType = await this.prisma.cartType.findFirst({
      where: {
        id: cartTypeId,
        organizationId,
      },
    });

    if (!cartType) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cart type not found',
      });
    }

    return cartType;
  }
}

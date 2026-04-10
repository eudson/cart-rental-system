import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CartStatus } from 'shared';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_CART_TRANSITIONS } from './constants/cart-status-transitions.constant';
import type { CreateCartDto } from './dto/create-cart.dto';
import type { ListCartsQueryDto } from './dto/list-carts-query.dto';
import type { UpdateCartDto } from './dto/update-cart.dto';

const CART_PUBLIC_SELECT = {
  id: true,
  organizationId: true,
  locationId: true,
  cartTypeId: true,
  label: true,
  year: true,
  color: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CartSelect;

type CartPublic = Prisma.CartGetPayload<{
  select: typeof CART_PUBLIC_SELECT;
}>;

@Injectable()
export class CartsService {
  private readonly logger = new Logger(CartsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCarts(organizationId: string, query: ListCartsQueryDto): Promise<{
    carts: CartPublic[];
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildListWhere(
      organizationId,
      normalizedSearch,
      query.locationId,
      query.status,
    );
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, carts] = await this.prisma.$transaction([
      this.prisma.cart.count({ where }),
      this.prisma.cart.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { label: 'asc' },
        select: CART_PUBLIC_SELECT,
      }),
    ]);

    return {
      carts,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  async createCart(organizationId: string, dto: CreateCartDto) {
    await this.findLocationOrThrow(organizationId, dto.locationId);
    await this.findCartTypeOrThrow(organizationId, dto.cartTypeId);

    this.logger.log(`Cart create initiated — org=${organizationId} label=${dto.label}`);

    return this.prisma.cart.create({
      data: {
        organizationId,
        locationId: dto.locationId,
        cartTypeId: dto.cartTypeId,
        label: dto.label,
        year: dto.year,
        color: dto.color,
        notes: dto.notes,
        status: dto.status,
      },
      select: CART_PUBLIC_SELECT,
    });
  }

  async getCartById(organizationId: string, cartId: string) {
    return this.findCartOrThrow(organizationId, cartId);
  }

  async updateCart(organizationId: string, cartId: string, dto: UpdateCartDto) {
    const existing = await this.findCartOrThrow(organizationId, cartId);

    if (dto.locationId) {
      await this.findLocationOrThrow(organizationId, dto.locationId);
    }

    if (dto.cartTypeId) {
      await this.findCartTypeOrThrow(organizationId, dto.cartTypeId);
    }

    if (dto.status) {
      this.validateStatusTransition(existing.status as CartStatus, dto.status);
    }

    this.logger.log(`Cart update initiated — org=${organizationId} cartId=${cartId}`);

    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        locationId: dto.locationId,
        cartTypeId: dto.cartTypeId,
        label: dto.label,
        year: dto.year,
        color: dto.color,
        notes: dto.notes,
        status: dto.status,
      },
      select: CART_PUBLIC_SELECT,
    });
  }

  async updateCartStatus(organizationId: string, cartId: string, nextStatus: CartStatus) {
    const existing = await this.findCartOrThrow(organizationId, cartId);

    this.validateStatusTransition(existing.status as CartStatus, nextStatus);

    this.logger.log(
      `Cart status update initiated — org=${organizationId} cartId=${cartId} from=${existing.status} to=${nextStatus}`,
    );

    return this.prisma.cart.update({
      where: { id: cartId },
      data: { status: nextStatus },
      select: CART_PUBLIC_SELECT,
    });
  }

  private buildListWhere(
    organizationId: string,
    search?: string,
    locationId?: string,
    status?: CartStatus,
  ): Prisma.CartWhereInput {
    if (!search) {
      return {
        organizationId,
        locationId,
        status,
      };
    }

    return {
      organizationId,
      locationId,
      status,
      OR: [
        { label: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private validateStatusTransition(currentStatus: CartStatus, nextStatus: CartStatus): void {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions = VALID_CART_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTransitions.includes(nextStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cart status change not allowed',
      });
    }
  }

  private async findCartOrThrow(organizationId: string, cartId: string): Promise<CartPublic> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        organizationId,
      },
      select: CART_PUBLIC_SELECT,
    });

    if (!cart) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cart not found' });
    }

    return cart;
  }

  private async findLocationOrThrow(organizationId: string, locationId: string): Promise<void> {
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

  private async findCartTypeOrThrow(organizationId: string, cartTypeId: string): Promise<void> {
    const cartType = await this.prisma.cartType.findFirst({
      where: {
        id: cartTypeId,
        organizationId,
      },
      select: { id: true },
    });

    if (!cartType) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cart type not found' });
    }
  }
}

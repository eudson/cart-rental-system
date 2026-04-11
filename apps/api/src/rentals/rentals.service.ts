import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CartStatus, RentalStatus, RentalType } from 'shared';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateRentalDto } from './dto/create-rental.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RENTAL_PUBLIC_SELECT = {
  id: true,
  organizationId: true,
  locationId: true,
  customerId: true,
  cartId: true,
  createdById: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  actualReturnDate: true,
  dailyRateSnapshot: true,
  monthlyRateSnapshot: true,
  totalAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RentalSelect;

type RentalPublic = Prisma.RentalGetPayload<{
  select: typeof RENTAL_PUBLIC_SELECT;
}>;

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRental(
    organizationId: string,
    createdById: string,
    dto: CreateRentalDto,
  ): Promise<RentalPublic> {
    if (dto.type !== RentalType.daily) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only daily rentals are currently supported',
      });
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const durationDays = this.calculateDailyDurationDays(startDate, endDate);

    this.logger.log(
      `Daily rental create initiated — org=${organizationId} customerId=${dto.customerId} cartId=${dto.cartId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId,
        },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      const cart = await tx.cart.findFirst({
        where: {
          id: dto.cartId,
          organizationId,
        },
        select: {
          id: true,
          organizationId: true,
          locationId: true,
          status: true,
          cartType: {
            select: {
              dailyRate: true,
            },
          },
        },
      });
      if (!cart) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Cart not found',
        });
      }

      if (cart.status !== CartStatus.available) {
        throw new ConflictException({
          code: 'CART_NOT_AVAILABLE',
          message: 'Cart is not available for the requested period',
        });
      }

      const overlap = await tx.rental.findFirst({
        where: {
          cartId: dto.cartId,
          organizationId,
          status: {
            in: [RentalStatus.pending, RentalStatus.active],
          },
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
        select: { id: true },
      });

      if (overlap) {
        throw new ConflictException({
          code: 'RENTAL_OVERLAP',
          message: 'Dates overlap with an existing rental',
        });
      }

      const dailyRateSnapshot = cart.cartType.dailyRate;
      const totalAmount = dailyRateSnapshot.mul(durationDays);

      const rental = await tx.rental.create({
        data: {
          organizationId,
          locationId: cart.locationId,
          customerId: dto.customerId,
          cartId: dto.cartId,
          createdById,
          type: RentalType.daily,
          status: RentalStatus.pending,
          startDate,
          endDate,
          dailyRateSnapshot,
          totalAmount,
          notes: dto.notes,
        },
        select: RENTAL_PUBLIC_SELECT,
      });

      await tx.cart.update({
        where: { id: dto.cartId },
        data: { status: CartStatus.reserved },
      });

      return rental;
    });
  }

  private calculateDailyDurationDays(startDate: Date, endDate: Date): number {
    if (startDate >= endDate) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'startDate must be before endDate',
      });
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / MS_PER_DAY;

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Daily rentals must be at least 1 full day',
      });
    }

    return durationDays;
  }
}

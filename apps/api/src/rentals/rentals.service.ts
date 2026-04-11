import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CartStatus, RentalStatus, RentalType } from 'shared';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import type { CreateRentalDto } from './dto/create-rental.dto';
import type { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';

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

const LEASE_CONTRACT_PUBLIC_SELECT = {
  id: true,
  rentalId: true,
  contractMonths: true,
  earlyTerminationFee: true,
  signedAt: true,
  documentUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeaseContractSelect;

type LeaseContractPublic = Prisma.LeaseContractGetPayload<{
  select: typeof LEASE_CONTRACT_PUBLIC_SELECT;
}>;

type RentalCartDetails = {
  id: string;
  locationId: string;
  status: CartStatus;
  cartType: {
    dailyRate: Prisma.Decimal;
    monthlyRate: Prisma.Decimal;
  };
};

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRental(
    organizationId: string,
    createdById: string,
    dto: CreateRentalDto,
  ): Promise<RentalPublic> {
    const startDate = new Date(dto.startDate);

    if (dto.type === RentalType.daily) {
      if (!dto.endDate) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'endDate is required for daily rentals',
        });
      }

      const endDate = new Date(dto.endDate);
      const durationDays = this.calculateDailyDurationDays(startDate, endDate);

      this.logger.log(
        `Daily rental create initiated — org=${organizationId} customerId=${dto.customerId} cartId=${dto.cartId}`,
      );

      return this.prisma.$transaction(async (tx) => {
        await this.findCustomerOrThrow(tx, organizationId, dto.customerId);
        const cart = await this.findCartForRentalOrThrow(tx, organizationId, dto.cartId);
        this.ensureCartAvailable(cart.status);
        await this.ensureNoRentalOverlap(
          tx,
          organizationId,
          dto.cartId,
          startDate,
          endDate,
        );

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

    if (dto.type === RentalType.lease) {
      const contractMonths = dto.contractMonths;

      if (contractMonths === undefined) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'contractMonths is required for lease rentals',
        });
      }

      this.logger.log(
        `Lease rental create initiated — org=${organizationId} customerId=${dto.customerId} cartId=${dto.cartId} contractMonths=${contractMonths}`,
      );

      return this.prisma.$transaction(async (tx) => {
        const organization = await this.findOrganizationOrThrow(tx, organizationId);

        if (contractMonths < organization.minLeaseMonths) {
          throw new UnprocessableEntityException({
            code: 'LEASE_MIN_MONTHS',
            message: 'Contract months below organization minimum',
          });
        }

        await this.findCustomerOrThrow(tx, organizationId, dto.customerId);
        const cart = await this.findCartForRentalOrThrow(tx, organizationId, dto.cartId);
        this.ensureCartAvailable(cart.status);

        const endDate = this.calculateLeaseEndDate(startDate, contractMonths);

        await this.ensureNoRentalOverlap(
          tx,
          organizationId,
          dto.cartId,
          startDate,
          endDate,
        );

        const monthlyRateSnapshot = cart.cartType.monthlyRate;
        const totalAmount = monthlyRateSnapshot.mul(contractMonths);

        const rental = await tx.rental.create({
          data: {
            organizationId,
            locationId: cart.locationId,
            customerId: dto.customerId,
            cartId: dto.cartId,
            createdById,
            type: RentalType.lease,
            status: RentalStatus.pending,
            startDate,
            endDate,
            monthlyRateSnapshot,
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

    throw new BadRequestException({
      code: 'BAD_REQUEST',
      message: 'Invalid rental type',
    });
  }

  async createLeaseContract(
    organizationId: string,
    rentalId: string,
    dto: CreateLeaseContractDto,
  ): Promise<LeaseContractPublic> {
    this.logger.log(
      `Lease contract create initiated — org=${organizationId} rentalId=${rentalId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      const organization = await this.findOrganizationOrThrow(tx, organizationId);
      await this.findLeaseRentalOrThrow(tx, organizationId, rentalId);

      if (dto.contractMonths < organization.minLeaseMonths) {
        throw new UnprocessableEntityException({
          code: 'LEASE_MIN_MONTHS',
          message: 'Contract months below organization minimum',
        });
      }

      const existing = await tx.leaseContract.findUnique({
        where: { rentalId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Lease contract already exists',
        });
      }

      return tx.leaseContract.create({
        data: {
          rentalId,
          contractMonths: dto.contractMonths,
          earlyTerminationFee: dto.earlyTerminationFee,
          signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
          documentUrl: dto.documentUrl,
        },
        select: LEASE_CONTRACT_PUBLIC_SELECT,
      });
    });
  }

  async updateLeaseContract(
    organizationId: string,
    rentalId: string,
    dto: UpdateLeaseContractDto,
  ): Promise<LeaseContractPublic> {
    this.logger.log(
      `Lease contract update initiated — org=${organizationId} rentalId=${rentalId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.findLeaseRentalOrThrow(tx, organizationId, rentalId);

      const existing = await tx.leaseContract.findUnique({
        where: { rentalId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Lease contract not found',
        });
      }

      return tx.leaseContract.update({
        where: { rentalId },
        data: {
          signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
          documentUrl: dto.documentUrl,
        },
        select: LEASE_CONTRACT_PUBLIC_SELECT,
      });
    });
  }

  async getLeaseContract(
    organizationId: string,
    rentalId: string,
  ): Promise<LeaseContractPublic> {
    await this.prisma.$transaction(async (tx) => {
      await this.findLeaseRentalOrThrow(tx, organizationId, rentalId);
    });

    const leaseContract = await this.prisma.leaseContract.findUnique({
      where: { rentalId },
      select: LEASE_CONTRACT_PUBLIC_SELECT,
    });

    if (!leaseContract) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Lease contract not found',
      });
    }

    return leaseContract;
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

  private calculateLeaseEndDate(startDate: Date, contractMonths: number): Date {
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + contractMonths);
    return endDate;
  }

  private async findOrganizationOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<{ id: string; minLeaseMonths: number }> {
    const organization = await tx.organization.findFirst({
      where: { id: organizationId },
      select: {
        id: true,
        minLeaseMonths: true,
      },
    });

    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    return organization;
  }

  private async findCustomerOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    customerId: string,
  ): Promise<void> {
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
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
  }

  private async findCartForRentalOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    cartId: string,
  ): Promise<RentalCartDetails> {
    const cart = await tx.cart.findFirst({
      where: {
        id: cartId,
        organizationId,
      },
      select: {
        id: true,
        locationId: true,
        status: true,
        cartType: {
          select: {
            dailyRate: true,
            monthlyRate: true,
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

    return {
      id: cart.id,
      locationId: cart.locationId,
      status: cart.status as CartStatus,
      cartType: {
        dailyRate: cart.cartType.dailyRate,
        monthlyRate: cart.cartType.monthlyRate,
      },
    };
  }

  private ensureCartAvailable(status: CartStatus): void {
    if (status !== CartStatus.available) {
      throw new ConflictException({
        code: 'CART_NOT_AVAILABLE',
        message: 'Cart is not available for the requested period',
      });
    }
  }

  private async ensureNoRentalOverlap(
    tx: Prisma.TransactionClient,
    organizationId: string,
    cartId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const overlap = await tx.rental.findFirst({
      where: {
        cartId,
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
  }

  private async findLeaseRentalOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rentalId: string,
  ): Promise<void> {
    const rental = await tx.rental.findFirst({
      where: {
        id: rentalId,
        organizationId,
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!rental) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Rental not found',
      });
    }

    if (rental.type !== RentalType.lease) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Lease contract is only supported for lease rentals',
      });
    }
  }
}

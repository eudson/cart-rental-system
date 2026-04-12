import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  CartStatus,
  PaymentMethod,
  PaymentStatus,
  RentalStatus,
  RentalType,
} from 'shared';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import type { CreateRentalPaymentDto } from './dto/create-rental-payment.dto';
import type { CreateRentalDto } from './dto/create-rental.dto';
import type { ListRentalPaymentsQueryDto } from './dto/list-rental-payments-query.dto';
import type { ListRentalsQueryDto } from './dto/list-rentals-query.dto';
import type { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';
import type { UpdateRentalPaymentDto } from './dto/update-rental-payment.dto';
import type { UpdateRentalDto } from './dto/update-rental.dto';

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
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  cart: {
    select: {
      id: true,
      label: true,
      status: true,
      cartTypeId: true,
    },
  },
  location: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.RentalSelect;

const RENTAL_LIST_SELECT = {
  ...RENTAL_PUBLIC_SELECT,
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  payments: {
    select: {
      amount: true,
    },
  },
  leaseContract: {
    select: {
      contractMonths: true,
    },
  },
} satisfies Prisma.RentalSelect;

type RentalPublic = Prisma.RentalGetPayload<{
  select: typeof RENTAL_PUBLIC_SELECT;
}>;

type RentalListRaw = Prisma.RentalGetPayload<{
  select: typeof RENTAL_LIST_SELECT;
}>;

type RentalListItem = Omit<RentalListRaw, 'payments' | 'leaseContract'> & {
  paidTotal: number;
  outstandingBalance: number;
  monthsRemaining: number | null;
};

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

const PAYMENT_PUBLIC_SELECT = {
  id: true,
  rentalId: true,
  organizationId: true,
  recordedById: true,
  amount: true,
  method: true,
  status: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

type PaymentPublic = Prisma.PaymentGetPayload<{
  select: typeof PAYMENT_PUBLIC_SELECT;
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

type RentalForAction = {
  id: string;
  cartId: string;
  type: RentalType;
  status: RentalStatus;
  startDate: Date;
  endDate: Date;
  dailyRateSnapshot: Prisma.Decimal | null;
  monthlyRateSnapshot: Prisma.Decimal | null;
  totalAmount: Prisma.Decimal | null;
  cart: {
    status: CartStatus;
  };
};

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listRentals(organizationId: string, query: ListRentalsQueryDto): Promise<{
    rentals: RentalListItem[];
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildListWhere(
      organizationId,
      normalizedSearch,
      query.type,
      query.status,
      query.customerId,
      query.cartId,
      query.startDateFrom,
      query.endDateTo,
    );
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, rawRentals] = await this.prisma.$transaction([
      this.prisma.rental.count({ where }),
      this.prisma.rental.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: RENTAL_LIST_SELECT,
      }),
    ]);

    const rentals = (rawRentals as RentalListRaw[]).map((raw) =>
      this.toRentalListItem(raw),
    );

    return {
      rentals,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

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

  async getRentalById(organizationId: string, rentalId: string): Promise<RentalPublic> {
    return this.findRentalForReadOrThrow(organizationId, rentalId);
  }

  async listRentalPayments(
    organizationId: string,
    rentalId: string,
    query: ListRentalPaymentsQueryDto,
  ): Promise<{
    payments: PaymentPublic[];
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildPaymentListWhere(organizationId, rentalId, normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    return this.prisma.$transaction(async (tx) => {
      await this.findRentalForPaymentsOrThrow(tx, organizationId, rentalId);

      const [totalItems, payments] = await Promise.all([
        tx.payment.count({ where }),
        tx.payment.findMany({
          where,
          skip: offset,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
          select: PAYMENT_PUBLIC_SELECT,
        }),
      ]);

      return {
        payments,
        pagination: buildPaginationMeta({
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          search: normalizedSearch,
        }),
      };
    });
  }

  async createRentalPayment(
    organizationId: string,
    rentalId: string,
    recordedById: string,
    dto: CreateRentalPaymentDto,
  ): Promise<PaymentPublic> {
    this.logger.log(
      `Rental payment create initiated — org=${organizationId} rentalId=${rentalId} recordedById=${recordedById}`,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.findRentalForPaymentsOrThrow(tx, organizationId, rentalId);

      return tx.payment.create({
        data: {
          rentalId,
          organizationId,
          recordedById,
          amount: dto.amount,
          method: dto.method,
          status: dto.status ?? PaymentStatus.unpaid,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
          notes: dto.notes,
        },
        select: PAYMENT_PUBLIC_SELECT,
      });
    });
  }

  async updateRentalPayment(
    organizationId: string,
    rentalId: string,
    paymentId: string,
    dto: UpdateRentalPaymentDto,
  ): Promise<PaymentPublic> {
    this.logger.log(
      `Rental payment update initiated — org=${organizationId} rentalId=${rentalId} paymentId=${paymentId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.findRentalForPaymentsOrThrow(tx, organizationId, rentalId);
      const payment = await this.findRentalPaymentOrThrow(
        tx,
        organizationId,
        rentalId,
        paymentId,
      );

      return tx.payment.update({
        where: { id: payment.id },
        data: {
          amount: dto.amount,
          method: dto.method,
          status: dto.status,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
          notes: dto.notes,
        },
        select: PAYMENT_PUBLIC_SELECT,
      });
    });
  }

  async updateRental(
    organizationId: string,
    rentalId: string,
    dto: UpdateRentalDto,
  ): Promise<RentalPublic> {
    this.logger.log(`Rental update initiated — org=${organizationId} rentalId=${rentalId}`);

    return this.prisma.$transaction(async (tx) => {
      const rental = await this.findRentalForUpdateOrThrow(tx, organizationId, rentalId);

      const nextStartDate = dto.startDate ? new Date(dto.startDate) : rental.startDate;
      const nextEndDate = dto.endDate ? new Date(dto.endDate) : rental.endDate;
      const isDateUpdate = dto.startDate !== undefined || dto.endDate !== undefined;

      if (isDateUpdate) {
        if (rental.status !== RentalStatus.pending) {
          throw new UnprocessableEntityException({
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Only pending rentals can update dates',
          });
        }

        this.ensureDateOrder(nextStartDate, nextEndDate);
        await this.ensureNoRentalOverlap(
          tx,
          organizationId,
          rental.cartId,
          nextStartDate,
          nextEndDate,
          rental.id,
        );
      }

      let nextTotalAmount = rental.totalAmount;

      if (isDateUpdate && rental.type === RentalType.daily && rental.dailyRateSnapshot) {
        const durationDays = this.calculateDailyDurationDays(nextStartDate, nextEndDate);
        nextTotalAmount = rental.dailyRateSnapshot.mul(durationDays);
      }

      return tx.rental.update({
        where: { id: rental.id },
        data: {
          startDate: isDateUpdate ? nextStartDate : undefined,
          endDate: isDateUpdate ? nextEndDate : undefined,
          notes: dto.notes,
          totalAmount: nextTotalAmount ?? undefined,
        },
        select: RENTAL_PUBLIC_SELECT,
      });
    });
  }

  async checkoutRental(
    organizationId: string,
    rentalId: string,
  ): Promise<RentalPublic> {
    this.logger.log(`Rental checkout initiated — org=${organizationId} rentalId=${rentalId}`);

    return this.prisma.$transaction(async (tx) => {
      const rental = await this.findRentalForActionOrThrow(tx, organizationId, rentalId);

      if (rental.status !== RentalStatus.pending || rental.cart.status !== CartStatus.reserved) {
        throw new UnprocessableEntityException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Rental checkout transition not allowed',
        });
      }

      const updatedRental = await tx.rental.update({
        where: { id: rental.id },
        data: { status: RentalStatus.active },
        select: RENTAL_PUBLIC_SELECT,
      });

      await tx.cart.update({
        where: { id: rental.cartId },
        data: { status: CartStatus.rented },
      });

      return updatedRental;
    });
  }

  async checkinRental(
    organizationId: string,
    rentalId: string,
  ): Promise<RentalPublic> {
    this.logger.log(`Rental checkin initiated — org=${organizationId} rentalId=${rentalId}`);

    return this.prisma.$transaction(async (tx) => {
      const rental = await this.findRentalForActionOrThrow(tx, organizationId, rentalId);

      if (rental.status !== RentalStatus.active || rental.cart.status !== CartStatus.rented) {
        throw new UnprocessableEntityException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Rental checkin transition not allowed',
        });
      }

      const actualReturnDate = new Date();
      const finalTotalAmount = this.calculateFinalCheckinAmount(rental);

      const updatedRental = await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: RentalStatus.completed,
          actualReturnDate,
          totalAmount: finalTotalAmount,
        },
        select: RENTAL_PUBLIC_SELECT,
      });

      await tx.cart.update({
        where: { id: rental.cartId },
        data: { status: CartStatus.available },
      });

      return updatedRental;
    });
  }

  async cancelRental(
    organizationId: string,
    rentalId: string,
  ): Promise<RentalPublic> {
    this.logger.log(`Rental cancel initiated — org=${organizationId} rentalId=${rentalId}`);

    return this.prisma.$transaction(async (tx) => {
      const rental = await this.findRentalForActionOrThrow(tx, organizationId, rentalId);

      if (rental.status !== RentalStatus.pending || rental.cart.status !== CartStatus.reserved) {
        throw new UnprocessableEntityException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Rental cancel transition not allowed',
        });
      }

      const updatedRental = await tx.rental.update({
        where: { id: rental.id },
        data: { status: RentalStatus.cancelled },
        select: RENTAL_PUBLIC_SELECT,
      });

      await tx.cart.update({
        where: { id: rental.cartId },
        data: { status: CartStatus.available },
      });

      return updatedRental;
    });
  }

  private calculateDailyDurationDays(startDate: Date, endDate: Date): number {
    this.ensureDateOrder(startDate, endDate);

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

  private ensureDateOrder(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'startDate must be before endDate',
      });
    }
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
    excludeRentalId?: string,
  ): Promise<void> {
    const overlap = await tx.rental.findFirst({
      where: {
        id: excludeRentalId ? { not: excludeRentalId } : undefined,
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

  private calculateFinalCheckinAmount(rental: RentalForAction): Prisma.Decimal | null {
    if (rental.type === RentalType.daily && rental.dailyRateSnapshot) {
      const durationDays = this.calculateDailyDurationDays(rental.startDate, rental.endDate);
      return rental.dailyRateSnapshot.mul(durationDays);
    }

    return rental.totalAmount;
  }

  private toRentalListItem(raw: RentalListRaw): RentalListItem {
    const paidTotal = raw.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalAmount = raw.totalAmount ? Number(raw.totalAmount) : 0;
    const outstandingBalance = Math.max(0, totalAmount - paidTotal);

    let monthsRemaining: number | null = null;
    if (raw.type === RentalType.lease && raw.leaseContract) {
      const contractMonths = raw.leaseContract.contractMonths;
      const startDate = new Date(raw.startDate);
      const now = new Date();
      const monthsElapsed =
        (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - startDate.getUTCMonth());
      monthsRemaining = Math.max(0, contractMonths - monthsElapsed);
    }

    const { payments: _payments, leaseContract: _leaseContract, ...rest } = raw;
    return {
      ...rest,
      paidTotal: Math.round(paidTotal * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      monthsRemaining,
    };
  }

  private buildListWhere(
    organizationId: string,
    search?: string,
    type?: RentalType,
    status?: RentalStatus,
    customerId?: string,
    cartId?: string,
    startDateFrom?: string,
    endDateTo?: string,
  ): Prisma.RentalWhereInput {
    const dateFilter: Prisma.RentalWhereInput = {
      endDate: startDateFrom ? { gte: new Date(startDateFrom) } : undefined,
      startDate: endDateTo ? { lte: new Date(endDateTo) } : undefined,
    };

    if (!search) {
      return {
        organizationId,
        type,
        status,
        customerId,
        cartId,
        ...dateFilter,
      };
    }

    return {
      organizationId,
      type,
      status,
      customerId,
      cartId,
      ...dateFilter,
      OR: [
        { notes: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { cart: { label: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  private buildPaymentListWhere(
    organizationId: string,
    rentalId: string,
    search?: string,
  ): Prisma.PaymentWhereInput {
    if (!search) {
      return {
        organizationId,
        rentalId,
      };
    }

    const methodFromSearch = this.parsePaymentMethodSearchTerm(search);
    const statusFromSearch = this.parsePaymentStatusSearchTerm(search);
    const searchClauses: Prisma.PaymentWhereInput[] = [
      { notes: { contains: search, mode: 'insensitive' } },
      { recordedBy: { name: { contains: search, mode: 'insensitive' } } },
    ];

    if (methodFromSearch) {
      searchClauses.push({ method: methodFromSearch });
    }

    if (statusFromSearch) {
      searchClauses.push({ status: statusFromSearch });
    }

    return {
      organizationId,
      rentalId,
      OR: searchClauses,
    };
  }

  private parsePaymentMethodSearchTerm(search: string): PaymentMethod | undefined {
    const normalizedSearch = search.toLowerCase();
    return Object.values(PaymentMethod).includes(normalizedSearch as PaymentMethod)
      ? (normalizedSearch as PaymentMethod)
      : undefined;
  }

  private parsePaymentStatusSearchTerm(search: string): PaymentStatus | undefined {
    const normalizedSearch = search.toLowerCase();
    return Object.values(PaymentStatus).includes(normalizedSearch as PaymentStatus)
      ? (normalizedSearch as PaymentStatus)
      : undefined;
  }

  private async findRentalForReadOrThrow(
    organizationId: string,
    rentalId: string,
  ): Promise<RentalPublic> {
    const rental = await this.prisma.rental.findFirst({
      where: {
        id: rentalId,
        organizationId,
      },
      select: RENTAL_PUBLIC_SELECT,
    });

    if (!rental) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Rental not found',
      });
    }

    return rental;
  }

  private async findRentalForPaymentsOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rentalId: string,
  ): Promise<void> {
    const rental = await tx.rental.findFirst({
      where: {
        id: rentalId,
        organizationId,
      },
      select: { id: true },
    });

    if (!rental) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Rental not found',
      });
    }
  }

  private async findRentalPaymentOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rentalId: string,
    paymentId: string,
  ): Promise<{ id: string }> {
    const payment = await tx.payment.findFirst({
      where: {
        id: paymentId,
        rentalId,
        organizationId,
      },
      select: { id: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }

    return payment;
  }

  private async findRentalForUpdateOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rentalId: string,
  ): Promise<{
    id: string;
    cartId: string;
    type: RentalType;
    status: RentalStatus;
    startDate: Date;
    endDate: Date;
    dailyRateSnapshot: Prisma.Decimal | null;
    monthlyRateSnapshot: Prisma.Decimal | null;
    totalAmount: Prisma.Decimal | null;
  }> {
    const rental = await tx.rental.findFirst({
      where: {
        id: rentalId,
        organizationId,
      },
      select: {
        id: true,
        cartId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        dailyRateSnapshot: true,
        monthlyRateSnapshot: true,
        totalAmount: true,
      },
    });

    if (!rental) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Rental not found',
      });
    }

    return {
      ...rental,
      type: rental.type as RentalType,
      status: rental.status as RentalStatus,
    };
  }

  private async findRentalForActionOrThrow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rentalId: string,
  ): Promise<RentalForAction> {
    const rental = await tx.rental.findFirst({
      where: {
        id: rentalId,
        organizationId,
      },
      select: {
        id: true,
        cartId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        dailyRateSnapshot: true,
        monthlyRateSnapshot: true,
        totalAmount: true,
        cart: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!rental) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Rental not found',
      });
    }

    return {
      ...rental,
      type: rental.type as RentalType,
      status: rental.status as RentalStatus,
      cart: {
        status: rental.cart.status as CartStatus,
      },
    };
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

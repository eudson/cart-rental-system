import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  buildPaginationMeta,
  calculatePaginationOffset,
} from '../common/pagination/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import type { ListPortalRentalsQueryDto } from './dto/list-portal-rentals-query.dto';

const PORTAL_RENTAL_SELECT = {
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

const PORTAL_PAYMENT_SELECT = {
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

const PORTAL_CONTRACT_SELECT = {
  id: true,
  rentalId: true,
  contractMonths: true,
  earlyTerminationFee: true,
  signedAt: true,
  documentUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeaseContractSelect;

const PORTAL_CUSTOMER_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  phone: true,
  idNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCustomerProfile(customerId: string, organizationId: string) {
    this.logger.log(`Portal profile fetched — customerId=${customerId} org=${organizationId}`);

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: PORTAL_CUSTOMER_SELECT,
    });

    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }

    return customer;
  }

  async listCustomerRentals(
    customerId: string,
    organizationId: string,
    query: ListPortalRentalsQueryDto,
  ) {
    const normalizedSearch = query.search?.trim() || undefined;
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const where: Prisma.RentalWhereInput = {
      customerId,
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [totalItems, rentals] = await this.prisma.$transaction([
      this.prisma.rental.count({ where }),
      this.prisma.rental.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: PORTAL_RENTAL_SELECT,
      }),
    ]);

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

  async getCustomerRental(customerId: string, organizationId: string, rentalId: string) {
    const rental = await this.prisma.rental.findFirst({
      where: { id: rentalId, customerId, organizationId },
      select: PORTAL_RENTAL_SELECT,
    });

    if (!rental) {
      throw new NotFoundException({ code: 'RENTAL_NOT_FOUND', message: 'Rental not found' });
    }

    return rental;
  }

  async getRentalContract(customerId: string, organizationId: string, rentalId: string) {
    await this.getCustomerRental(customerId, organizationId, rentalId);

    const contract = await this.prisma.leaseContract.findUnique({
      where: { rentalId },
      select: PORTAL_CONTRACT_SELECT,
    });

    if (!contract) {
      throw new NotFoundException({
        code: 'LEASE_CONTRACT_NOT_FOUND',
        message: 'Lease contract not found for this rental',
      });
    }

    return contract;
  }

  async listRentalPayments(
    customerId: string,
    organizationId: string,
    rentalId: string,
    page: number,
    pageSize: number,
  ) {
    await this.getCustomerRental(customerId, organizationId, rentalId);

    const offset = calculatePaginationOffset(page, pageSize);

    const [totalItems, payments] = await this.prisma.$transaction([
      this.prisma.payment.count({ where: { rentalId, organizationId } }),
      this.prisma.payment.findMany({
        where: { rentalId, organizationId },
        skip: offset,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: PORTAL_PAYMENT_SELECT,
      }),
    ]);

    return {
      payments,
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }
}

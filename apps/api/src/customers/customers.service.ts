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
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

const BCRYPT_ROUNDS = 12;

const CUSTOMER_PUBLIC_SELECT = {
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
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(organizationId: string, query: ListCustomersQueryDto): Promise<{
    customers: Array<{
      id: string;
      organizationId: string;
      name: string;
      email: string;
      phone: string | null;
      idNumber: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const normalizedSearch = query.search?.trim() || undefined;
    const where = this.buildSearchWhere(organizationId, normalizedSearch);
    const offset = calculatePaginationOffset(query.page, query.pageSize);

    const [totalItems, customers] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip: offset,
        take: query.pageSize,
        orderBy: { name: 'asc' },
        select: CUSTOMER_PUBLIC_SELECT,
      }),
    ]);

    return {
      customers,
      pagination: buildPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        search: normalizedSearch,
      }),
    };
  }

  async createCustomer(organizationId: string, dto: CreateCustomerDto) {
    this.logger.log(`Customer create initiated — org=${organizationId} email=${dto.email}`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      return await this.prisma.customer.create({
        data: {
          organizationId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          idNumber: dto.idNumber,
          passwordHash,
        },
        select: CUSTOMER_PUBLIC_SELECT,
      });
    } catch (error) {
      if (this.isDuplicateEmailConflict(error)) {
        throw new ConflictException({
          code: 'CUSTOMER_EMAIL_EXISTS',
          message: 'Email already registered in this org',
        });
      }
      throw error;
    }
  }

  async getCustomerById(organizationId: string, customerId: string) {
    return this.findCustomerOrThrow(organizationId, customerId);
  }

  async updateCustomer(organizationId: string, customerId: string, dto: UpdateCustomerDto) {
    await this.findCustomerOrThrow(organizationId, customerId);

    this.logger.log(
      `Customer update initiated — org=${organizationId} customerId=${customerId}`,
    );

    const data: Prisma.CustomerUpdateInput = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      idNumber: dto.idNumber,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    try {
      return await this.prisma.customer.update({
        where: { id: customerId },
        data,
        select: CUSTOMER_PUBLIC_SELECT,
      });
    } catch (error) {
      if (this.isDuplicateEmailConflict(error)) {
        throw new ConflictException({
          code: 'CUSTOMER_EMAIL_EXISTS',
          message: 'Email already registered in this org',
        });
      }
      throw error;
    }
  }

  private buildSearchWhere(
    organizationId: string,
    search?: string,
  ): Prisma.CustomerWhereInput {
    if (!search) {
      return { organizationId };
    }

    return {
      organizationId,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async findCustomerOrThrow(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
      select: CUSTOMER_PUBLIC_SELECT,
    });

    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });
    }

    return customer;
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

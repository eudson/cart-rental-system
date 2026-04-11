import { Injectable, Logger } from '@nestjs/common';
import type {
  DashboardActionItem,
  DashboardCapacityItem,
  DashboardOverview,
} from 'shared';
import { CartStatus, PaymentStatus, RentalStatus, RentalType } from 'shared';

import { PrismaService } from '../prisma/prisma.service';

type DashboardCartRecord = {
  id: string;
  locationId: string;
  cartTypeId: string;
  status: CartStatus;
};

type DashboardRentalRecord = {
  id: string;
  locationId: string;
  type: RentalType;
  status: RentalStatus;
  startDate: Date;
  endDate: Date;
  totalAmount: { toString(): string } | null;
  customer: {
    name: string;
  };
  cart: {
    label: string;
    cartTypeId: string;
  };
  location: {
    name: string;
  };
  payments: Array<{
    status: PaymentStatus;
  }>;
};

type DashboardReferenceRecord = {
  id: string;
  name: string;
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(organizationId: string): Promise<DashboardOverview> {
    this.logger.log(`Dashboard overview requested — org=${organizationId}`);

    const [carts, rentals, locations, cartTypes] = await this.prisma.$transaction([
      this.prisma.cart.findMany({
        where: { organizationId },
        select: {
          id: true,
          locationId: true,
          cartTypeId: true,
          status: true,
        },
      }),
      this.prisma.rental.findMany({
        where: {
          organizationId,
          status: {
            in: [RentalStatus.pending, RentalStatus.active],
          },
        },
        orderBy: {
          startDate: 'asc',
        },
        select: {
          id: true,
          locationId: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          totalAmount: true,
          customer: {
            select: {
              name: true,
            },
          },
          cart: {
            select: {
              label: true,
              cartTypeId: true,
            },
          },
          location: {
            select: {
              name: true,
            },
          },
          payments: {
            select: {
              status: true,
            },
          },
        },
      }),
      this.prisma.location.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.cartType.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    const typedCarts = carts as DashboardCartRecord[];
    const typedRentals = rentals as DashboardRentalRecord[];
    const typedLocations = locations as DashboardReferenceRecord[];
    const typedCartTypes = cartTypes as DashboardReferenceRecord[];

    const fleetOverview = this.buildFleetOverview(typedCarts);
    const rentalMix = this.buildRentalMix(typedRentals);
    const actionQueue = this.buildActionQueue(typedRentals);
    const capacitySignals = {
      byLocation: this.buildCapacityItems(typedLocations, typedCarts, typedRentals, 'location'),
      byCartType: this.buildCapacityItems(typedCartTypes, typedCarts, typedRentals, 'cartType'),
    };

    return {
      fleetOverview,
      rentalMix,
      actionQueue,
      capacitySignals,
    };
  }

  private buildFleetOverview(carts: DashboardCartRecord[]) {
    const totalCarts = carts.length;
    const availableCarts = carts.filter((cart) => cart.status === CartStatus.available).length;
    const reservedCarts = carts.filter((cart) => cart.status === CartStatus.reserved).length;
    const rentedCarts = carts.filter((cart) => cart.status === CartStatus.rented).length;
    const retiredCarts = carts.filter((cart) => cart.status === CartStatus.retired).length;

    return {
      totalCarts,
      availableCarts,
      reservedCarts,
      rentedCarts,
      retiredCarts,
      utilizationRate: this.calculateRate(reservedCarts + rentedCarts, totalCarts),
    };
  }

  private buildRentalMix(rentals: DashboardRentalRecord[]) {
    const activeRentals = rentals.filter((rental) => rental.status === RentalStatus.active);
    const pendingRentals = rentals.filter((rental) => rental.status === RentalStatus.pending);

    const paymentAttentionRentals = activeRentals.filter((rental) => {
      if (rental.payments.length === 0) {
        return true;
      }

      return rental.payments.some(
        (payment) =>
          payment.status === PaymentStatus.unpaid || payment.status === PaymentStatus.partial,
      );
    }).length;

    return {
      activeDailyRentals: activeRentals.filter((rental) => rental.type === RentalType.daily).length,
      activeLeaseRentals: activeRentals.filter((rental) => rental.type === RentalType.lease).length,
      pendingDailyRentals: pendingRentals.filter((rental) => rental.type === RentalType.daily).length,
      pendingLeaseRentals: pendingRentals.filter((rental) => rental.type === RentalType.lease).length,
      paymentAttentionRentals,
    };
  }

  private buildActionQueue(rentals: DashboardRentalRecord[]) {
    const { startOfTodayUtc, startOfTomorrowUtc } = this.getUtcDayBounds();

    const checkoutsToday = rentals
      .filter(
        (rental) =>
          rental.status === RentalStatus.pending &&
          rental.startDate >= startOfTodayUtc &&
          rental.startDate < startOfTomorrowUtc,
      )
      .map((rental) => this.toActionItem(rental));

    const checkinsToday = rentals
      .filter(
        (rental) =>
          rental.status === RentalStatus.active &&
          rental.endDate >= startOfTodayUtc &&
          rental.endDate < startOfTomorrowUtc,
      )
      .map((rental) => this.toActionItem(rental));

    const overdueReturns = rentals
      .filter(
        (rental) =>
          rental.status === RentalStatus.active && rental.endDate < startOfTodayUtc,
      )
      .map((rental) => this.toActionItem(rental));

    return {
      checkoutsTodayCount: checkoutsToday.length,
      checkinsTodayCount: checkinsToday.length,
      overdueReturnsCount: overdueReturns.length,
      checkoutsToday,
      checkinsToday,
      overdueReturns,
    };
  }

  private buildCapacityItems(
    references: DashboardReferenceRecord[],
    carts: DashboardCartRecord[],
    rentals: DashboardRentalRecord[],
    dimension: 'location' | 'cartType',
  ): DashboardCapacityItem[] {
    const items = references.map((reference) => {
      const matchingCarts = carts.filter((cart) =>
        dimension === 'location' ? cart.locationId === reference.id : cart.cartTypeId === reference.id,
      );

      const activeRentals = rentals.filter((rental) => {
        if (rental.status !== RentalStatus.active) {
          return false;
        }

        return dimension === 'location'
          ? rental.locationId === reference.id
          : rental.cart.cartTypeId === reference.id;
      });

      const totalCarts = matchingCarts.length;
      const availableCarts = matchingCarts.filter((cart) => cart.status === CartStatus.available).length;
      const reservedCarts = matchingCarts.filter((cart) => cart.status === CartStatus.reserved).length;
      const rentedCarts = matchingCarts.filter((cart) => cart.status === CartStatus.rented).length;
      const retiredCarts = matchingCarts.filter((cart) => cart.status === CartStatus.retired).length;

      return {
        id: reference.id,
        name: reference.name,
        totalCarts,
        availableCarts,
        reservedCarts,
        rentedCarts,
        retiredCarts,
        activeDailyRentals: activeRentals.filter((rental) => rental.type === RentalType.daily).length,
        activeLeaseRentals: activeRentals.filter((rental) => rental.type === RentalType.lease).length,
        utilizationRate: this.calculateRate(reservedCarts + rentedCarts, totalCarts),
      };
    });

    return items.sort((left, right) => {
      if (left.availableCarts !== right.availableCarts) {
        return left.availableCarts - right.availableCarts;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private toActionItem(rental: DashboardRentalRecord): DashboardActionItem {
    return {
      rentalId: rental.id,
      customerName: rental.customer.name,
      cartLabel: rental.cart.label,
      locationName: rental.location.name,
      type: rental.type,
      status: rental.status,
      startDate: rental.startDate.toISOString(),
      endDate: rental.endDate.toISOString(),
      totalAmount: rental.totalAmount ? rental.totalAmount.toString() : null,
    };
  }

  private getUtcDayBounds() {
    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfTomorrowUtc = new Date(startOfTodayUtc);
    startOfTomorrowUtc.setUTCDate(startOfTomorrowUtc.getUTCDate() + 1);

    return {
      startOfTodayUtc,
      startOfTomorrowUtc,
    };
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(1));
  }
}
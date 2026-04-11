import { RentalStatus } from '../enums/rental-status.enum';
import { RentalType } from '../enums/rental-type.enum';

export interface DashboardFleetOverview {
  totalCarts: number;
  availableCarts: number;
  reservedCarts: number;
  rentedCarts: number;
  retiredCarts: number;
  utilizationRate: number;
}

export interface DashboardRentalMix {
  activeDailyRentals: number;
  activeLeaseRentals: number;
  pendingDailyRentals: number;
  pendingLeaseRentals: number;
  paymentAttentionRentals: number;
}

export interface DashboardActionItem {
  rentalId: string;
  customerName: string;
  cartLabel: string;
  locationName: string;
  type: RentalType;
  status: RentalStatus;
  startDate: string;
  endDate: string;
  totalAmount: string | null;
}

export interface DashboardActionQueue {
  checkoutsTodayCount: number;
  checkinsTodayCount: number;
  overdueReturnsCount: number;
  checkoutsToday: DashboardActionItem[];
  checkinsToday: DashboardActionItem[];
  overdueReturns: DashboardActionItem[];
}

export interface DashboardCapacityItem {
  id: string;
  name: string;
  totalCarts: number;
  availableCarts: number;
  reservedCarts: number;
  rentedCarts: number;
  retiredCarts: number;
  activeDailyRentals: number;
  activeLeaseRentals: number;
  utilizationRate: number;
}

export interface DashboardCapacitySignals {
  byLocation: DashboardCapacityItem[];
  byCartType: DashboardCapacityItem[];
}

export interface DashboardOverview {
  fleetOverview: DashboardFleetOverview;
  rentalMix: DashboardRentalMix;
  actionQueue: DashboardActionQueue;
  capacitySignals: DashboardCapacitySignals;
}
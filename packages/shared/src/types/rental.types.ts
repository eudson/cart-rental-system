import { RentalStatus } from '../enums/rental-status.enum';
import { RentalType } from '../enums/rental-type.enum';
import { CartStatus } from '../enums/cart-status.enum';

export interface RentalCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface RentalCartSummary {
  id: string;
  label: string;
  status: CartStatus;
  cartTypeId: string;
}

export interface RentalLocationSummary {
  id: string;
  name: string;
}

export interface Rental {
  id: string;
  organizationId: string;
  locationId: string;
  customerId: string;
  cartId: string;
  createdById: string;
  type: RentalType;
  status: RentalStatus;
  startDate: string;
  endDate: string;
  actualReturnDate: string | null;
  dailyRateSnapshot: string | null;
  monthlyRateSnapshot: string | null;
  totalAmount: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: RentalCustomerSummary;
  cart: RentalCartSummary;
  location: RentalLocationSummary;
}

export interface LeaseContract {
  id: string;
  rentalId: string;
  contractMonths: number;
  earlyTerminationFee: string | null;
  signedAt: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

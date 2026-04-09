import { RentalStatus } from '../enums/rental-status.enum';
import { RentalType } from '../enums/rental-type.enum';

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

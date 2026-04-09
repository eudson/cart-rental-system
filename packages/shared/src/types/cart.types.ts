import { CartStatus } from '../enums/cart-status.enum';

export interface CartType {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  dailyRate: string;
  monthlyRate: string;
  seatingCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  organizationId: string;
  locationId: string;
  cartTypeId: string;
  label: string;
  year: number | null;
  color: string | null;
  notes: string | null;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
}

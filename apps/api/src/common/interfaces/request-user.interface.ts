import { UserRole } from 'shared';

export interface StaffRequestUser {
  userId: string;
  organizationId: string;
  role: UserRole;
}

export interface CustomerRequestUser {
  customerId: string;
  organizationId: string;
  role: 'customer';
}

export type RequestUser = StaffRequestUser | CustomerRequestUser;

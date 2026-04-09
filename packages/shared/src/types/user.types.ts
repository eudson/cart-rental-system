import { LocationStatus } from '../enums/location-status.enum';
import { OrgStatus } from '../enums/org-status.enum';
import { UserRole } from '../enums/roles.enum';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  minLeaseMonths: number;
  defaultDailyRate: string | null;
  defaultMonthlyRate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  timezone: string;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  locationId: string | null;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string | null;
  idNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

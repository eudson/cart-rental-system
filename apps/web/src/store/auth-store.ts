import { create } from 'zustand';
import type { Customer, Organization, User } from 'shared';

type SessionType = 'staff' | 'customer' | null;

interface StaffSessionPayload {
  organization: Organization;
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface CustomerSessionPayload {
  organization: Organization;
  customer: Customer;
  accessToken: string;
}

interface AuthStoreState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  accessToken: string | null;
  refreshToken: string | null;
  currentOrganization: Organization | null;
  currentUser: User | null;
  currentCustomer: Customer | null;
  setStaffSession: (payload: StaffSessionPayload) => void;
  setCustomerSession: (payload: CustomerSessionPayload) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setCurrentOrganization: (organization: Organization | null) => void;
  clearAuthState: () => void;
}

const INITIAL_AUTH_STATE = {
  isAuthenticated: false,
  sessionType: null as SessionType,
  accessToken: null,
  refreshToken: null,
  currentOrganization: null,
  currentUser: null,
  currentCustomer: null,
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  ...INITIAL_AUTH_STATE,
  setStaffSession: ({ organization, user, accessToken, refreshToken }) => {
    set({
      isAuthenticated: true,
      sessionType: 'staff',
      accessToken,
      refreshToken,
      currentOrganization: organization,
      currentUser: user,
      currentCustomer: null,
    });
  },
  setCustomerSession: ({ organization, customer, accessToken }) => {
    set({
      isAuthenticated: true,
      sessionType: 'customer',
      accessToken,
      refreshToken: null,
      currentOrganization: organization,
      currentUser: null,
      currentCustomer: customer,
    });
  },
  setAccessToken: (accessToken) => {
    set({ accessToken, isAuthenticated: true });
  },
  setRefreshToken: (refreshToken) => {
    set({ refreshToken });
  },
  setCurrentOrganization: (currentOrganization) => {
    set({ currentOrganization });
  },
  clearAuthState: () => {
    set(INITIAL_AUTH_STATE);
  },
}));

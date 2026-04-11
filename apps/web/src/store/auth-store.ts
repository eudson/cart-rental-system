import { create } from 'zustand';
import type { Customer, Organization, SessionRole, User } from 'shared';

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
  refreshToken?: string | null;
}

interface TokenSessionPayload {
  sessionType: Exclude<SessionType, null>;
  sessionRole: SessionRole;
  accessToken: string;
  refreshToken?: string | null;
}

interface AuthStoreState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  sessionRole: SessionRole | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentOrganization: Organization | null;
  currentUser: User | null;
  currentCustomer: Customer | null;
  setStaffSession: (payload: StaffSessionPayload) => void;
  setCustomerSession: (payload: CustomerSessionPayload) => void;
  setTokenSession: (payload: TokenSessionPayload) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setCurrentOrganization: (organization: Organization | null) => void;
  clearAuthState: () => void;
}

const INITIAL_AUTH_STATE = {
  isAuthenticated: false,
  sessionType: null as SessionType,
  sessionRole: null as SessionRole | null,
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
      sessionRole: user.role,
      accessToken,
      refreshToken,
      currentOrganization: organization,
      currentUser: user,
      currentCustomer: null,
    });
  },
  setCustomerSession: ({ organization, customer, accessToken, refreshToken = null }) => {
    set({
      isAuthenticated: true,
      sessionType: 'customer',
      sessionRole: 'customer',
      accessToken,
      refreshToken,
      currentOrganization: organization,
      currentUser: null,
      currentCustomer: customer,
    });
  },
  setTokenSession: ({ sessionType, sessionRole, accessToken, refreshToken = null }) => {
    set({
      isAuthenticated: true,
      sessionType,
      sessionRole,
      accessToken,
      refreshToken,
      currentOrganization: null,
      currentUser: null,
      currentCustomer: null,
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

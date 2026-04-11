import type { ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom';
import { UserRole } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { AppLayout } from '@/components/layout/app-layout';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { CustomerLoginPage, StaffLoginPage } from '@/pages/auth/login-page';
import { CartDetailPage } from '@/pages/carts/cart-detail-page';
import { CartsListPage } from '@/pages/carts/carts-list-page';
import { CustomerDetailPage } from '@/pages/customers/customer-detail-page';
import { CustomersListPage } from '@/pages/customers/customers-list-page';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { NewRentalPage } from '@/pages/rentals/new-rental-page';
import { RentalCheckinPage } from '@/pages/rentals/rental-checkin-page';
import { RentalCheckoutPage } from '@/pages/rentals/rental-checkout-page';
import { RentalDetailPage } from '@/pages/rentals/rental-detail-page';
import { RentalsListPage } from '@/pages/rentals/rentals-list-page';
import { PortalRentalDetailPage } from '@/pages/portal/portal-rental-detail-page';
import { PortalRentalsListPage } from '@/pages/portal/portal-rentals-list-page';
import { SettingsCartTypesPage } from '@/pages/settings/settings-cart-types-page';
import { SettingsLocationsPage } from '@/pages/settings/settings-locations-page';
import { SettingsOrganizationPage } from '@/pages/settings/settings-organization-page';
import { SettingsUsersPage } from '@/pages/settings/settings-users-page';
import { useAuthStore } from '@/store/auth-store';

const STAFF_AND_ADMIN_ROLES = [
  UserRole.staff,
  UserRole.org_admin,
  UserRole.super_admin,
] as const;

const ORG_ADMIN_ROLES = [UserRole.org_admin] as const;

type AppRouteRole = UserRole | 'customer' | 'public';

interface AppScaffoldPageProps {
  title: string;
  description: string;
  currentPath: string;
}

interface RouteAccessGateProps {
  allowedRoles: readonly AppRouteRole[];
  children: ReactNode;
}

function getLoginPath(allowedRoles: readonly AppRouteRole[]): string {
  return allowedRoles.includes('customer') ? '/portal/login' : '/login';
}

function getDefaultPathForSession(sessionType: 'staff' | 'customer'): string {
  return sessionType === 'customer' ? '/portal/rentals' : '/dashboard';
}

function RouteAccessGate({ allowedRoles, children }: RouteAccessGateProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionType = useAuthStore((state) => state.sessionType);
  const sessionRole = useAuthStore((state) => state.sessionRole);

  if (allowedRoles.includes('public')) {
    if (!isAuthenticated || !sessionType || !sessionRole) {
      return <>{children}</>;
    }

    return <Navigate to={getDefaultPathForSession(sessionType)} replace />;
  }

  if (!isAuthenticated || !sessionType || !sessionRole) {
    return (
      <Navigate
        to={getLoginPath(allowedRoles)}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!allowedRoles.includes(sessionRole)) {
    return <Navigate to={getDefaultPathForSession(sessionType)} replace />;
  }

  return <>{children}</>;
}

function StaffRoutePage({ title, description, currentPath }: AppScaffoldPageProps) {
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const currentUser = useAuthStore((state) => state.currentUser);
  const sessionRole = useAuthStore((state) => state.sessionRole);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);

  const userRole =
    currentUser?.role ??
    (sessionRole && sessionRole !== 'customer' ? sessionRole : UserRole.org_admin);

  return (
    <AppLayout
      pageTitle={title}
      currentPath={currentPath}
      orgName={currentOrganization?.name ?? 'Demo Golf Carts'}
      userName={currentUser?.name ?? 'Operations User'}
      userRole={userRole}
      onLogout={clearAuthState}
    >
      <PageWrapper title={title} subtitle={description}>
        <EmptyState
          heading={`${title} is ready for implementation`}
          subtext="Route wiring is complete. The corresponding page feature task is next in Phase 6."
        />
      </PageWrapper>
    </AppLayout>
  );
}

function buildRoute(path: string, element: ReactNode, allowedRoles: readonly AppRouteRole[]) {
  return {
    path,
    element: <RouteAccessGate allowedRoles={allowedRoles}>{element}</RouteAccessGate>,
  };
}

const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  buildRoute('/login', <StaffLoginPage />, ['public']),
  buildRoute('/portal/login', <CustomerLoginPage />, ['public']),
  buildRoute(
    '/dashboard',
    <DashboardPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/carts',
    <CartsListPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/carts/:id',
    <CartDetailPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/customers',
    <CustomersListPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/customers/:id',
    <CustomerDetailPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals',
    <RentalsListPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/new',
    <NewRentalPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id',
    <RentalDetailPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id/checkout',
    <RentalCheckoutPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id/checkin',
    <RentalCheckinPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/payments',
    <StaffRoutePage
      title="Payments"
      description="Payment recording and tracking page route."
      currentPath="/payments"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/organization',
    <SettingsOrganizationPage />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/locations',
    <SettingsLocationsPage />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/cart-types',
    <SettingsCartTypesPage />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/users',
    <SettingsUsersPage />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/portal/rentals',
    <PortalRentalsListPage />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id',
    <PortalRentalDetailPage />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id/contract',
    <PortalRentalDetailPage />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id/payments',
    <PortalRentalDetailPage />,
    ['customer'],
  ),
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={appRouter} />;
}

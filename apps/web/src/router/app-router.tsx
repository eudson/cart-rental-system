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
import { RentalDetailPage } from '@/pages/rentals/rental-detail-page';
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

function PortalRoutePage({ title, description }: Omit<AppScaffoldPageProps, 'currentPath'>) {
  const currentCustomer = useAuthStore((state) => state.currentCustomer);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);

  return (
    <div className="min-h-screen bg-[var(--color-background-subtle)] px-6 py-8">
      <PageWrapper
        title={title}
        subtitle={
          currentCustomer && currentOrganization
            ? `${description} Signed in as ${currentCustomer.name} (${currentOrganization.name}).`
            : description
        }
      >
        <EmptyState
          heading={`${title} route is wired`}
          subtext="Customer portal routing is configured; read-only page implementation follows in later Phase 6 tasks."
        />
      </PageWrapper>
    </div>
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
    <StaffRoutePage
      title="Dashboard"
      description="Operations overview for active rentals, cart status, and today’s check-ins/check-outs."
      currentPath="/dashboard"
    />,
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
    <StaffRoutePage
      title="Rentals"
      description="Rental list with filters and lifecycle actions."
      currentPath="/rentals"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/new',
    <StaffRoutePage
      title="New Rental"
      description="Multi-step rental creation flow route."
      currentPath="/rentals"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id',
    <RentalDetailPage />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id/checkout',
    <StaffRoutePage
      title="Rental Checkout"
      description="Checkout confirmation screen route."
      currentPath="/rentals"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/rentals/:id/checkin',
    <StaffRoutePage
      title="Rental Check-in"
      description="Check-in confirmation route with final amount presentation."
      currentPath="/rentals"
    />,
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
    <StaffRoutePage
      title="Organization Settings"
      description="Organization-level settings route restricted to org admins."
      currentPath="/settings/organization"
    />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/locations',
    <StaffRoutePage
      title="Locations"
      description="Location management route restricted to org admins."
      currentPath="/settings/locations"
    />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/cart-types',
    <StaffRoutePage
      title="Cart Types"
      description="Cart type management route restricted to org admins."
      currentPath="/settings/cart-types"
    />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/settings/users',
    <StaffRoutePage
      title="Users"
      description="User management route restricted to org admins."
      currentPath="/settings/users"
    />,
    ORG_ADMIN_ROLES,
  ),
  buildRoute(
    '/portal/rentals',
    <PortalRoutePage
      title="Portal Rentals"
      description="Customer route for listing own rentals in read-only mode."
    />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id',
    <PortalRoutePage
      title="Portal Rental Detail"
      description="Customer route for viewing rental details."
    />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id/contract',
    <PortalRoutePage
      title="Portal Lease Contract"
      description="Customer route for viewing lease contract details."
    />,
    ['customer'],
  ),
  buildRoute(
    '/portal/rentals/:id/payments',
    <PortalRoutePage
      title="Portal Payments"
      description="Customer route for viewing rental payment history."
    />,
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

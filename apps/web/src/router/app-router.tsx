import type { ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { UserRole } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { AppLayout } from '@/components/layout/app-layout';
import { PageWrapper } from '@/components/layout/page-wrapper';

const STAFF_AND_ADMIN_ROLES = [
  UserRole.staff,
  UserRole.org_admin,
  UserRole.super_admin,
] as const;

const ORG_ADMIN_ROLES = [UserRole.org_admin] as const;

type AppRouteRole = UserRole | 'customer' | 'public';

interface RouteHandle {
  allowedRoles: readonly AppRouteRole[];
}

interface AppScaffoldPageProps {
  title: string;
  description: string;
  currentPath: string;
}

function AuthRoutePage({ title, description }: Omit<AppScaffoldPageProps, 'currentPath'>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-subtle)] px-6 py-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-8 shadow-sm">
        <h1>{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StaffRoutePage({ title, description, currentPath }: AppScaffoldPageProps) {
  return (
    <AppLayout
      pageTitle={title}
      currentPath={currentPath}
      orgName="Demo Golf Carts"
      userName="Alex Johnson"
      userRole={UserRole.org_admin}
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
  return (
    <div className="min-h-screen bg-[var(--color-background-subtle)] px-6 py-8">
      <PageWrapper title={title} subtitle={description}>
        <EmptyState
          heading={`${title} route is wired`}
          subtext="Customer portal routing is configured; read-only page implementation follows in later Phase 6 tasks."
        />
      </PageWrapper>
    </div>
  );
}

function buildRoute(
  path: string,
  element: ReactNode,
  allowedRoles: readonly AppRouteRole[],
) {
  return {
    path,
    element,
    handle: {
      allowedRoles,
    } satisfies RouteHandle,
  };
}

const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    handle: { allowedRoles: ['public'] } satisfies RouteHandle,
  },
  buildRoute(
    '/login',
    <AuthRoutePage
      title="Staff/Admin Login"
      description="Public route for staff and organization administrators to access operations pages."
    />,
    ['public'],
  ),
  buildRoute(
    '/portal/login',
    <AuthRoutePage
      title="Customer Portal Login"
      description="Public route for customers to access read-only rental, contract, and payment views."
    />,
    ['public'],
  ),
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
    <StaffRoutePage
      title="Carts"
      description="Cart inventory list and registration workflows for operations teams."
      currentPath="/carts"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/carts/:id',
    <StaffRoutePage
      title="Cart Detail"
      description="Single-cart detail view including current rental context and history."
      currentPath="/carts"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/customers',
    <StaffRoutePage
      title="Customers"
      description="Customer listing and search surface for staff/admin workflows."
      currentPath="/customers"
    />,
    STAFF_AND_ADMIN_ROLES,
  ),
  buildRoute(
    '/customers/:id',
    <StaffRoutePage
      title="Customer Detail"
      description="Customer profile and rental history view."
      currentPath="/customers"
    />,
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
    <StaffRoutePage
      title="Rental Detail"
      description="Rental detail, contract, and payment records route."
      currentPath="/rentals"
    />,
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
    handle: { allowedRoles: ['public'] } satisfies RouteHandle,
  },
]);

export function AppRouter() {
  return <RouterProvider router={appRouter} />;
}

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CalendarClock, CalendarSync, CarFront, CreditCard, MapPinned, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardActionItem, DashboardCapacityItem } from 'shared';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatStatusLabel } from '@/lib/format';
import { getDashboardOverview } from '@/services/dashboard-service';

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg bg-secondary p-3 text-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function ActionQueueCard({
  title,
  count,
  viewAllHref,
  items,
  emptyHeading,
  emptySubtext,
}: {
  title: string;
  count: number;
  viewAllHref: string;
  items: DashboardActionItem[];
  emptyHeading: string;
  emptySubtext: string;
}) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <Link
            to={viewAllHref}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {count} total — View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            heading={emptyHeading}
            subtext={emptySubtext}
            className="min-h-[220px]"
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.rentalId}
                to={`/rentals/${item.rentalId}`}
                className="block rounded-lg border border-border bg-[var(--color-background-subtle)] p-4 transition-colors hover:border-border-strong hover:bg-[var(--color-background-muted)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.customerName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.cartLabel} at {item.locationName}
                    </p>
                  </div>
                  <StatusBadge type="rental" status={item.status} />
                </div>
                <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                  <p>Type: {formatStatusLabel(item.type)}</p>
                  <p>Start: {formatDate(item.startDate)}</p>
                  <p>End: {formatDate(item.endDate)}</p>
                </div>
                <p className="mt-2 text-sm text-foreground">Amount: {formatCurrency(item.totalAmount)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CapacityTable({
  title,
  items,
  icon,
  emptyHeading,
  emptySubtext,
}: {
  title: string;
  items: DashboardCapacityItem[];
  icon: ReactNode;
  emptyHeading: string;
  emptySubtext: string;
}) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            heading={emptyHeading}
            subtext={emptySubtext}
            className="min-h-[220px]"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Name</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Available</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Reserved</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Rented</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Retired</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Daily</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Leases</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/40">
                  <TableCell className="px-4 py-3 text-sm font-medium text-foreground">{item.name}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">{item.availableCarts}/{item.totalCarts}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.reservedCarts}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.rentedCarts}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.retiredCarts}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.activeDailyRentals}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.activeLeaseRentals}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm text-foreground">{formatPercentage(item.utilizationRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });

  return (
    <StaffPageLayout
      title="Dashboard"
      subtitle="Owner view of fleet availability, rental mix, action queue, and capacity pressure."
      currentPath="/dashboard"
    >
      {dashboardQuery.isError ? (
        <PageError
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : 'Unable to load dashboard overview.'
          }
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : dashboardQuery.isLoading ? (
        <DashboardPageSkeleton />
      ) : dashboardQuery.data ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Fleet Utilization"
              value={formatPercentage(dashboardQuery.data.fleetOverview.utilizationRate)}
              detail={`${dashboardQuery.data.fleetOverview.rentedCarts + dashboardQuery.data.fleetOverview.reservedCarts} carts currently committed`}
              icon={<CarFront className="h-5 w-5" />}
            />
            <MetricCard
              title="Available Inventory"
              value={String(dashboardQuery.data.fleetOverview.availableCarts)}
              detail={`${dashboardQuery.data.fleetOverview.totalCarts} total carts in fleet`}
              icon={<CarFront className="h-5 w-5" />}
            />
            <MetricCard
              title="Active Daily Rentals"
              value={String(dashboardQuery.data.rentalMix.activeDailyRentals)}
              detail="Daily rentals currently checked out"
              icon={<CalendarSync className="h-5 w-5" />}
            />
            <MetricCard
              title="Active Leases"
              value={String(dashboardQuery.data.rentalMix.activeLeaseRentals)}
              detail="Long-term carts currently committed"
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <MetricCard
              title="Payment Attention"
              value={String(dashboardQuery.data.rentalMix.paymentAttentionRentals)}
              detail="Active rentals with unpaid, partial, or missing payments"
              icon={<CreditCard className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Reserved"
              value={String(dashboardQuery.data.fleetOverview.reservedCarts)}
              detail={`${dashboardQuery.data.rentalMix.pendingDailyRentals} daily, ${dashboardQuery.data.rentalMix.pendingLeaseRentals} lease pending starts`}
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <MetricCard
              title="Rented"
              value={String(dashboardQuery.data.fleetOverview.rentedCarts)}
              detail="Carts currently out with customers"
              icon={<CarFront className="h-5 w-5" />}
            />
            <MetricCard
              title="Retired"
              value={String(dashboardQuery.data.fleetOverview.retiredCarts)}
              detail="Unavailable fleet removed from rotation"
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <MetricCard
              title="Check-outs Today"
              value={String(dashboardQuery.data.actionQueue.checkoutsTodayCount)}
              detail="Pending rentals scheduled to start today"
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <MetricCard
              title="Overdue Returns"
              value={String(dashboardQuery.data.actionQueue.overdueReturnsCount)}
              detail="Active rentals whose return date already passed"
              icon={<AlertCircle className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ActionQueueCard
              title="Check-outs Today"
              count={dashboardQuery.data.actionQueue.checkoutsTodayCount}
              viewAllHref="/rentals?status=pending"
              items={dashboardQuery.data.actionQueue.checkoutsToday}
              emptyHeading="No check-outs scheduled"
              emptySubtext="Nothing is queued to start today."
            />
            <ActionQueueCard
              title="Check-ins Today"
              count={dashboardQuery.data.actionQueue.checkinsTodayCount}
              viewAllHref="/rentals?status=active"
              items={dashboardQuery.data.actionQueue.checkinsToday}
              emptyHeading="No check-ins due"
              emptySubtext="There are no active rentals ending today."
            />
            <ActionQueueCard
              title="Overdue Returns"
              count={dashboardQuery.data.actionQueue.overdueReturnsCount}
              viewAllHref="/rentals?status=active"
              items={dashboardQuery.data.actionQueue.overdueReturns}
              emptyHeading="No overdue returns"
              emptySubtext="All active rentals are still inside their expected return window."
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <CapacityTable
              title="Capacity by Location"
              items={dashboardQuery.data.capacitySignals.byLocation}
              icon={<MapPinned className="h-5 w-5" />}
              emptyHeading="No locations yet"
              emptySubtext="Add a location to start tracking local fleet pressure."
            />
            <CapacityTable
              title="Capacity by Cart Type"
              items={dashboardQuery.data.capacitySignals.byCartType}
              icon={<Tag className="h-5 w-5" />}
              emptyHeading="No cart types yet"
              emptySubtext="Add a cart type to compare inventory against active demand."
            />
          </div>
        </div>
      ) : null}
    </StaffPageLayout>
  );
}
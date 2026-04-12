import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  Mail,
  MapPinned,
  Phone,
  Tag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PaymentStatus, RentalStatus, RentalType } from 'shared';
import type { DashboardActionItem, DashboardCapacityItem, DashboardOverview, PaginationMeta, RentalListItem } from 'shared';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { RecordPaymentDialog } from '@/components/rentals/record-payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/format';
import { getDashboardOverview } from '@/services/dashboard-service';
import { listRentals } from '@/services/rentals-service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrencyNum(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function atRiskSortPriority(rental: RentalListItem, today: Date): number {
  const isPaidZero = rental.paidTotal === 0;
  const hasBalance = rental.outstandingBalance > 0;
  const isOverdue = new Date(rental.endDate) < today;
  const in30Days = new Date(rental.endDate) < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (!hasBalance) return 4;
  if (isPaidZero && isOverdue) return 0;
  if (isPaidZero && in30Days) return 1;
  if (!isPaidZero && hasBalance) return 2;
  return 3;
}

function sortAtRisk(rentals: RentalListItem[]): RentalListItem[] {
  const today = startOfTodayUTC();
  return [...rentals].sort((a, b) => {
    const pa = atRiskSortPriority(a, today);
    const pb = atRiskSortPriority(b, today);
    if (pa !== pb) return pa - pb;
    return b.outstandingBalance - a.outstandingBalance;
  });
}

// ─── Shared card components ──────────────────────────────────────────────────

function FinancialCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: 'red' | 'green' | 'default';
}) {
  const valueColor =
    color === 'red'
      ? 'text-[var(--color-status-unpaid)]'
      : color === 'green'
        ? 'text-[var(--color-status-completed)]'
        : 'text-foreground';

  const labelColor =
    color === 'red'
      ? 'text-[var(--color-status-unpaid)]'
      : color === 'green'
        ? 'text-[var(--color-status-completed)]'
        : 'text-muted-foreground';

  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardContent className="p-5">
        <p className={`text-xs font-medium uppercase tracking-wide ${labelColor}`}>{label}</p>
        <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
        {subtext ? <p className="mt-1 text-xs text-muted-foreground">{subtext}</p> : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
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
  const displayItems = items.slice(0, 5);
  const extra = items.length - displayItems.length;

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
        {displayItems.length === 0 ? (
          <EmptyState heading={emptyHeading} subtext={emptySubtext} className="min-h-[200px]" />
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => (
              <Link
                key={item.rentalId}
                to={`/rentals/${item.rentalId}`}
                className="block rounded-lg border border-border bg-[var(--color-background-subtle)] px-4 py-3 transition-colors hover:border-border-strong hover:bg-[var(--color-background-muted)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.cartLabel} · {formatDate(item.endDate)}
                    </p>
                  </div>
                  <StatusBadge type="rental" status={item.status} />
                </div>
              </Link>
            ))}
            {extra > 0 ? (
              <Link
                to={viewAllHref}
                className="block pt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                and {extra} more...
              </Link>
            ) : null}
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
          <EmptyState heading={emptyHeading} subtext={emptySubtext} className="min-h-[200px]" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Name</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Available</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Reserved</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Rented</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Retired</TableHead>
                <TableHead className="border-l border-border px-4 py-3 text-xs font-medium uppercase tracking-wide">Daily</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Leases</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Util %</TableHead>
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
                  <TableCell className="border-l border-border px-4 py-3 text-sm text-muted-foreground">{item.activeDailyRentals}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.activeLeaseRentals}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm text-foreground">{item.utilizationRate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── At-risk table ───────────────────────────────────────────────────────────

function AtRiskTable({
  rentals,
  showMonthsRemaining,
  onRecordPayment,
}: {
  rentals: RentalListItem[];
  showMonthsRemaining: boolean;
  onRecordPayment: (rentalId: string) => void;
}) {
  const [expandedContactIds, setExpandedContactIds] = useState<Set<string>>(new Set());
  const today = startOfTodayUTC();

  const atRisk = sortAtRisk(rentals.filter((r) => r.outstandingBalance > 0));

  function toggleContact(id: string) {
    setExpandedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function daysOverdue(endDate: string): number {
    const diff = today.getTime() - new Date(endDate).getTime();
    return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
  }

  const colSpan = showMonthsRemaining ? 10 : 9;

  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-medium">Payment Attention Required</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {atRisk.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {atRisk.length === 0 ? (
          <EmptyState
            heading="No payments require attention"
            subtext="All active rentals are cleared or have no outstanding balance."
            className="min-h-[160px]"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Customer</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Cart</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Start / End</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Total</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Paid</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Balance</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Status</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Overdue</TableHead>
                {showMonthsRemaining ? (
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Months Left</TableHead>
                ) : null}
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRisk.map((rental) => {
                const isOverdue = new Date(rental.endDate) < today;
                const overdueDays = isOverdue ? daysOverdue(rental.endDate) : null;
                const isContactExpanded = expandedContactIds.has(rental.id);

                return (
                  <>
                    <TableRow key={rental.id} className="group hover:bg-[var(--color-background-muted)]">
                      <TableCell className="px-4 py-3">
                        <Link
                          to={`/customers/${rental.customerId}`}
                          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {rental.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {rental.cart.label}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">
                        {formatCurrency(rental.totalAmount)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">
                        {formatCurrencyNum(rental.paidTotal)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium text-[var(--color-status-unpaid)]">
                        {formatCurrencyNum(rental.outstandingBalance)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge
                          type="payment"
                          status={
                            rental.paidTotal === 0
                              ? PaymentStatus.unpaid
                              : rental.outstandingBalance > 0
                                ? PaymentStatus.partial
                                : PaymentStatus.paid
                          }
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {overdueDays !== null ? (
                          <span className="text-[var(--color-status-unpaid)]">{overdueDays}d</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {showMonthsRemaining ? (
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {rental.monthsRemaining !== null ? `${rental.monthsRemaining} mo` : '—'}
                        </TableCell>
                      ) : null}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onRecordPayment(rental.id)}
                          >
                            <CreditCard className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                            <Link to={`/rentals/${rental.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => toggleContact(rental.id)}
                          >
                            {isContactExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isContactExpanded ? (
                      <TableRow key={`${rental.id}-contact`} className="bg-[var(--color-background-subtle)]">
                        <TableCell colSpan={colSpan} className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-6 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span>{rental.customer.phone ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span>{rental.customer.email}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Rental list table ───────────────────────────────────────────────────────

function RentalListTable({
  rentals,
  isLoading,
  pagination,
  statusFilter,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
}: {
  rentals: RentalListItem[];
  isLoading: boolean;
  pagination?: PaginationMeta;
  statusFilter: string;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  onStatusChange: (s: string) => void;
}) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-medium">All Rentals</CardTitle>
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value={RentalStatus.pending}>Pending</SelectItem>
              <SelectItem value={RentalStatus.active}>Active</SelectItem>
              <SelectItem value={RentalStatus.completed}>Completed</SelectItem>
              <SelectItem value={RentalStatus.cancelled}>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rentals.length === 0 ? (
          <EmptyState
            heading="No rentals found"
            subtext="No rentals match the current filter."
            className="min-h-[160px]"
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Customer</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Cart</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Start / End</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Total</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Balance</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => (
                  <TableRow key={rental.id} className="hover:bg-[var(--color-background-muted)]">
                    <TableCell className="px-4 py-3">
                      <Link
                        to={`/rentals/${rental.id}`}
                        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {rental.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {rental.cart.label}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-foreground">
                      {formatCurrency(rental.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {rental.outstandingBalance > 0 ? (
                        <span className="text-[var(--color-status-unpaid)]">
                          {formatCurrencyNum(rental.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-status-completed)]">Cleared</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge type="rental" status={rental.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pagination ? (
              <div className="mt-4">
                <PaginationControls
                  pagination={pagination}
                  onPageChange={onPageChange}
                  onPageSizeChange={(ps) => {
                    onPageSizeChange(ps);
                    onPageChange(1);
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: DashboardOverview }) {
  const { financialSummary, fleetOverview, rentalMix, actionQueue, capacitySignals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <FinancialCard
          label="Outstanding Balance"
          value={formatCurrencyNum(financialSummary.outstandingTotal)}
          subtext="Across all active rentals"
          color="default"
        />
        <FinancialCard
          label="Overdue"
          value={`${financialSummary.overdueCount} rental${financialSummary.overdueCount !== 1 ? 's' : ''}`}
          subtext={financialSummary.overdueAmount > 0 ? `${formatCurrencyNum(financialSummary.overdueAmount)} outstanding` : 'No overdue amount'}
          color={financialSummary.overdueCount > 0 ? 'red' : 'default'}
        />
        <FinancialCard
          label="Ending in 30 Days (Unpaid)"
          value={`${financialSummary.endingSoonUnpaidCount} rental${financialSummary.endingSoonUnpaidCount !== 1 ? 's' : ''}`}
          subtext={financialSummary.endingSoonUnpaidAmount > 0 ? `${formatCurrencyNum(financialSummary.endingSoonUnpaidAmount)} at risk` : 'None unpaid'}
          color={financialSummary.endingSoonUnpaidCount > 0 ? 'red' : 'default'}
        />
        <FinancialCard
          label="Paid This Month"
          value={formatCurrencyNum(financialSummary.paidMtd)}
          subtext="Recorded in the current calendar month"
          color="green"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard
          title="Utilization"
          value={`${fleetOverview.utilizationRate.toFixed(1)}%`}
          detail={`${fleetOverview.rentedCarts + fleetOverview.reservedCarts} of ${fleetOverview.totalCarts} carts committed`}
        />
        <MetricCard
          title="Available"
          value={String(fleetOverview.availableCarts)}
          detail="Ready to assign"
        />
        <MetricCard
          title="Active Daily"
          value={String(rentalMix.activeDailyRentals)}
          detail="Checked out"
        />
        <MetricCard
          title="Active Leases"
          value={String(rentalMix.activeLeaseRentals)}
          detail="Ongoing long-term"
        />
        <MetricCard
          title="Payment Attention"
          value={String(rentalMix.paymentAttentionRentals)}
          detail="Unpaid or partial active rentals"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionQueueCard
          title="Check-outs Today"
          count={actionQueue.checkoutsTodayCount}
          viewAllHref="/rentals?status=pending"
          items={actionQueue.checkoutsToday}
          emptyHeading="No check-outs scheduled"
          emptySubtext="Nothing queued to start today."
        />
        <ActionQueueCard
          title="Check-ins Today"
          count={actionQueue.checkinsTodayCount}
          viewAllHref="/rentals?status=active"
          items={actionQueue.checkinsToday}
          emptyHeading="No check-ins due"
          emptySubtext="No active rentals end today."
        />
        <ActionQueueCard
          title="Overdue Returns"
          count={actionQueue.overdueReturnsCount}
          viewAllHref="/rentals?status=active"
          items={actionQueue.overdueReturns}
          emptyHeading="No overdue returns"
          emptySubtext="All active rentals are within their window."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CapacityTable
          title="Capacity by Location"
          items={capacitySignals.byLocation}
          icon={<MapPinned className="h-5 w-5" />}
          emptyHeading="No locations yet"
          emptySubtext="Add a location to track local fleet pressure."
        />
        <CapacityTable
          title="Capacity by Cart Type"
          items={capacitySignals.byCartType}
          icon={<Tag className="h-5 w-5" />}
          emptyHeading="No cart types yet"
          emptySubtext="Add a cart type to compare inventory against demand."
        />
      </div>
    </div>
  );
}

// ─── Tab: Inventory ──────────────────────────────────────────────────────────

function InventoryTab({ data }: { data: DashboardOverview }) {
  const { fleetOverview, capacitySignals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <FinancialCard label="Available" value={String(fleetOverview.availableCarts)} subtext={`of ${fleetOverview.totalCarts} total carts`} color="default" />
        <FinancialCard label="Reserved" value={String(fleetOverview.reservedCarts)} subtext="Pending check-outs" color="default" />
        <FinancialCard label="Rented" value={String(fleetOverview.rentedCarts)} subtext="Currently out" color="default" />
        <FinancialCard label="Retired" value={String(fleetOverview.retiredCarts)} subtext="Removed from rotation" color="default" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CapacityTable
          title="Capacity by Location"
          items={capacitySignals.byLocation}
          icon={<MapPinned className="h-5 w-5" />}
          emptyHeading="No locations yet"
          emptySubtext="Add a location to track local fleet pressure."
        />
        <CapacityTable
          title="Capacity by Cart Type"
          items={capacitySignals.byCartType}
          icon={<Tag className="h-5 w-5" />}
          emptyHeading="No cart types yet"
          emptySubtext="Add a cart type to compare inventory against demand."
        />
      </div>
    </div>
  );
}

// ─── Tab: Daily Rentals ──────────────────────────────────────────────────────

function DailyRentalsTab({
  data,
  onRecordPayment,
}: {
  data: DashboardOverview;
  onRecordPayment: (rentalId: string) => void;
}) {
  const today = startOfTodayUTC();

  const activeQuery = useQuery({
    queryKey: ['rentals', 'daily', 'active-bulk'],
    queryFn: () =>
      listRentals({ type: RentalType.daily, status: RentalStatus.active, page: 1, pageSize: 100 }),
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');

  const allQuery = useQuery({
    queryKey: ['rentals', 'daily', 'all', page, pageSize, statusFilter],
    queryFn: () =>
      listRentals({
        type: RentalType.daily,
        page,
        pageSize,
        status: statusFilter !== 'all' ? (statusFilter as RentalStatus) : undefined,
      }),
  });

  const activeRentals = activeQuery.data?.rentals ?? [];
  const unpaidCount = activeRentals.filter((r) => r.paidTotal === 0).length;
  const unpaidAmount = activeRentals.filter((r) => r.paidTotal === 0).reduce((s, r) => s + r.outstandingBalance, 0);
  const partialCount = activeRentals.filter((r) => r.paidTotal > 0 && r.outstandingBalance > 0).length;
  const partialAmount = activeRentals.filter((r) => r.paidTotal > 0 && r.outstandingBalance > 0).reduce((s, r) => s + r.outstandingBalance, 0);
  const overdueCount = activeRentals.filter((r) => new Date(r.endDate) < today).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <FinancialCard
          label="Active"
          value={String(data.rentalMix.activeDailyRentals)}
          subtext="Daily rentals currently active"
          color="default"
        />
        <FinancialCard
          label="Unpaid"
          value={`${unpaidCount} rental${unpaidCount !== 1 ? 's' : ''}`}
          subtext={unpaidCount > 0 ? `${formatCurrencyNum(unpaidAmount)} outstanding` : 'None unpaid'}
          color={unpaidCount > 0 ? 'red' : 'default'}
        />
        <FinancialCard
          label="Partial"
          value={`${partialCount} rental${partialCount !== 1 ? 's' : ''}`}
          subtext={partialCount > 0 ? `${formatCurrencyNum(partialAmount)} remaining` : 'None partial'}
          color={partialCount > 0 ? 'red' : 'default'}
        />
        <FinancialCard
          label="Overdue Returns"
          value={String(overdueCount)}
          subtext="Active rentals past end date"
          color={overdueCount > 0 ? 'red' : 'default'}
        />
      </div>

      {activeQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <AtRiskTable
          rentals={activeRentals}
          showMonthsRemaining={false}
          onRecordPayment={onRecordPayment}
        />
      )}

      <RentalListTable
        rentals={allQuery.data?.rentals ?? []}
        isLoading={allQuery.isLoading}
        pagination={allQuery.data?.pagination}
        statusFilter={statusFilter}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setPage(1);
        }}
      />
    </div>
  );
}

// ─── Tab: Leases ─────────────────────────────────────────────────────────────

function LeasesTab({
  data,
  onRecordPayment,
}: {
  data: DashboardOverview;
  onRecordPayment: (rentalId: string) => void;
}) {
  const monthStart = startOfCurrentMonthUTC();
  const monthEnd = startOfNextMonthUTC();

  const activeQuery = useQuery({
    queryKey: ['rentals', 'lease', 'active-bulk'],
    queryFn: () =>
      listRentals({ type: RentalType.lease, status: RentalStatus.active, page: 1, pageSize: 100 }),
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');

  const allQuery = useQuery({
    queryKey: ['rentals', 'lease', 'all', page, pageSize, statusFilter],
    queryFn: () =>
      listRentals({
        type: RentalType.lease,
        page,
        pageSize,
        status: statusFilter !== 'all' ? (statusFilter as RentalStatus) : undefined,
      }),
  });

  const activeRentals = activeQuery.data?.rentals ?? [];
  const outstandingTotal = activeRentals.reduce((s, r) => s + r.outstandingBalance, 0);
  const endingThisMonthCount = activeRentals.filter((r) => {
    const end = new Date(r.endDate);
    return end >= monthStart && end < monthEnd;
  }).length;
  const unpaidThisMonthCount = activeRentals.filter((r) => {
    const end = new Date(r.endDate);
    return end >= monthStart && end < monthEnd && r.outstandingBalance > 0;
  }).length;
  const unpaidThisMonthAmount = activeRentals
    .filter((r) => {
      const end = new Date(r.endDate);
      return end >= monthStart && end < monthEnd && r.outstandingBalance > 0;
    })
    .reduce((s, r) => s + r.outstandingBalance, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <FinancialCard
          label="Active Leases"
          value={String(data.rentalMix.activeLeaseRentals)}
          subtext="Long-term leases currently active"
          color="default"
        />
        <FinancialCard
          label="Unpaid This Month"
          value={`${unpaidThisMonthCount} lease${unpaidThisMonthCount !== 1 ? 's' : ''}`}
          subtext={unpaidThisMonthCount > 0 ? `${formatCurrencyNum(unpaidThisMonthAmount)} outstanding` : 'None unpaid'}
          color={unpaidThisMonthCount > 0 ? 'red' : 'default'}
        />
        <FinancialCard
          label="Ending This Month"
          value={String(endingThisMonthCount)}
          subtext="Leases expiring in the current month"
          color="default"
        />
        <FinancialCard
          label="Outstanding Total"
          value={formatCurrencyNum(outstandingTotal)}
          subtext="Across all active leases"
          color={outstandingTotal > 0 ? 'default' : 'green'}
        />
      </div>

      {activeQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <AtRiskTable
          rentals={activeRentals}
          showMonthsRemaining={true}
          onRecordPayment={onRecordPayment}
        />
      )}

      <RentalListTable
        rentals={allQuery.data?.rentals ?? []}
        isLoading={allQuery.isLoading}
        pagination={allQuery.data?.pagination}
        statusFilter={statusFilter}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setPage(1);
        }}
      />
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [paymentDialogRentalId, setPaymentDialogRentalId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });

  function handleRecordPayment(rentalId: string) {
    setPaymentDialogRentalId(rentalId);
  }

  function handlePaymentSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['rentals'] });
  }

  return (
    <StaffPageLayout
      title="Dashboard"
      subtitle="Financial health, fleet status, and action queue."
      currentPath="/dashboard"
    >
      {dashboardQuery.isError ? (
        <PageError
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : 'Unable to load dashboard.'
          }
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : dashboardQuery.isLoading ? (
        <DashboardPageSkeleton />
      ) : dashboardQuery.data ? (
        <>
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="border-b border-border bg-transparent p-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="inventory"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Inventory
              </TabsTrigger>
              <TabsTrigger
                value="daily"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Daily Rentals
              </TabsTrigger>
              <TabsTrigger
                value="leases"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Leases
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab data={dashboardQuery.data} />
            </TabsContent>

            <TabsContent value="inventory" className="mt-0">
              <InventoryTab data={dashboardQuery.data} />
            </TabsContent>

            <TabsContent value="daily" className="mt-0">
              <DailyRentalsTab data={dashboardQuery.data} onRecordPayment={handleRecordPayment} />
            </TabsContent>

            <TabsContent value="leases" className="mt-0">
              <LeasesTab data={dashboardQuery.data} onRecordPayment={handleRecordPayment} />
            </TabsContent>
          </Tabs>

          {paymentDialogRentalId !== null ? (
            <RecordPaymentDialog
              rentalId={paymentDialogRentalId}
              open={true}
              onOpenChange={(open) => {
                if (!open) setPaymentDialogRentalId(null);
              }}
              onSuccess={handlePaymentSuccess}
            />
          ) : null}
        </>
      ) : null}
    </StaffPageLayout>
  );
}
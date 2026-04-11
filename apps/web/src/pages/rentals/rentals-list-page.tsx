import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RentalStatus, RentalType } from 'shared';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatStatusLabel } from '@/lib/format';
import { listRentals } from '@/services/rentals-service';

type RentalTypeFilter = RentalType | 'all';
type RentalStatusFilter = RentalStatus | 'all';

function toStartOfDayIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function toEndOfDayIso(value: string): string {
  return `${value}T23:59:59.999Z`;
}

export function RentalsListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RentalTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('all');
  const [startDateFrom, setStartDateFrom] = useState('');
  const [endDateTo, setEndDateTo] = useState('');

  const rentalsQuery = useQuery({
    queryKey: [
      'rentals',
      page,
      pageSize,
      appliedSearch,
      typeFilter,
      statusFilter,
      startDateFrom,
      endDateTo,
    ],
    queryFn: () =>
      listRentals({
        page,
        pageSize,
        search: appliedSearch || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDateFrom: startDateFrom ? toStartOfDayIso(startDateFrom) : undefined,
        endDateTo: endDateTo ? toEndOfDayIso(endDateTo) : undefined,
      }),
  });

  function applySearch() {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setStartDateFrom('');
    setEndDateTo('');
    setPage(1);
  }

  const rentals = rentalsQuery.data?.rentals ?? [];
  const pagination = rentalsQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Rentals"
      subtitle="Search active and upcoming rentals, then move into detail or start a new rental flow."
      currentPath="/rentals"
      headingSlot={
        <Button asChild>
          <Link to="/rentals/new">
            <Plus className="h-4 w-4" />
            New Rental
          </Link>
        </Button>
      }
    >
      <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by customer, cart label, or notes"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applySearch();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={applySearch}>
                <Search className="h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </label>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value as RentalTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value={RentalType.daily}>Daily</SelectItem>
                <SelectItem value={RentalType.lease}>Lease</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as RentalStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
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

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start From
            </label>
            <Input
              className="mt-1.5"
              type="date"
              value={startDateFrom}
              onChange={(event) => {
                setStartDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              End To
            </label>
            <Input
              className="mt-1.5"
              type="date"
              value={endDateTo}
              onChange={(event) => {
                setEndDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      {rentalsQuery.isError ? (
        <PageError
          message={
            rentalsQuery.error instanceof Error
              ? rentalsQuery.error.message
              : 'Unable to load rentals.'
          }
          onRetry={() => rentalsQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {rentalsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rentals.length === 0 ? (
            <EmptyState
              heading="No rentals found"
              subtext="Adjust filters or create a rental to populate the schedule."
              action={
                <Button asChild>
                  <Link to="/rentals/new">New Rental</Link>
                </Button>
              }
              className="min-h-[240px]"
            />
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Customer</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Cart</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Location</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Type</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Status</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Start</TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">End</TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((rental) => (
                    <TableRow key={rental.id} className="hover:bg-muted/40">
                      <TableCell className="px-4 py-3">
                        <Link className="text-sm font-medium text-foreground hover:underline" to={`/rentals/${rental.id}`}>
                          {rental.customer.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{rental.customer.email}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">{rental.cart.label}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{rental.location.name}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">{formatStatusLabel(rental.type)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge type="rental" status={rental.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{formatDate(rental.startDate)}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{formatDate(rental.endDate)}</TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(rental.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination ? (
                <PaginationControls
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </StaffPageLayout>
  );
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RentalStatus, RentalType } from 'shared';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StatusBadge } from '@/components/common/status-badge';
import { PortalLayout } from '@/components/layout/portal-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatStatusLabel } from '@/lib/format';
import { listPortalRentals } from '@/services/portal-service';

type RentalTypeFilter = RentalType | 'all';
type RentalStatusFilter = RentalStatus | 'all';

export function PortalRentalsListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<RentalTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('all');

  const rentalsQuery = useQuery({
    queryKey: ['portal', 'rentals', page, pageSize, typeFilter, statusFilter],
    queryFn: () =>
      listPortalRentals({
        page,
        pageSize,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
  });

  const rentals = rentalsQuery.data?.rentals ?? [];
  const pagination = rentalsQuery.data?.pagination;

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Rentals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all your cart rentals and their current status.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as RentalTypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value={RentalType.daily}>Daily</SelectItem>
              <SelectItem value={RentalType.lease}>Lease</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as RentalStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
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

        {rentalsQuery.isError && (
          <PageError
            message="Failed to load rentals."
            onRetry={() => rentalsQuery.refetch()}
          />
        )}

        {rentalsQuery.isPending && (
          <div className="space-y-2 p-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        )}

        {!rentalsQuery.isPending && !rentalsQuery.isError && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Cart
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Type
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Start date
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    End date
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10">
                      <EmptyState
                        heading="No rentals found"
                        subtext="Your rentals will appear here once they are created."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rentals.map((rental) => (
                    <TableRow
                      key={rental.id}
                      className="cursor-pointer hover:bg-[var(--color-background-muted)]"
                    >
                      <TableCell className="px-4 py-3">
                        <Link
                          to={`/portal/rentals/${rental.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {rental.cart.label}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {rental.location.name}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {formatStatusLabel(rental.type)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge type="rental" status={rental.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {formatDate(rental.startDate)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {formatDate(rental.endDate)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm">
                        {formatCurrency(rental.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {pagination && rentals.length > 0 && (
              <div className="px-5 py-4">
                <PaginationControls
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}

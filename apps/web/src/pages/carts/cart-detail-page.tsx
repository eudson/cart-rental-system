import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { RentalStatus } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatDateTime, formatStatusLabel } from '@/lib/format';
import { getCartById } from '@/services/carts-service';
import { listRentals } from '@/services/rentals-service';

export function CartDetailPage() {
  const { id: cartId } = useParams<{ id: string }>();
  const safeCartId = cartId ?? '';

  const cartQuery = useQuery({
    queryKey: ['cart', safeCartId],
    queryFn: () => getCartById(safeCartId),
    enabled: safeCartId.length > 0,
  });

  const rentalsQuery = useQuery({
    queryKey: ['cart-rentals', safeCartId],
    queryFn: () =>
      listRentals({
        page: 1,
        pageSize: 50,
        cartId: safeCartId,
      }),
    enabled: safeCartId.length > 0,
  });

  const currentRental = useMemo(() => {
    const rentals = rentalsQuery.data?.rentals ?? [];
    return rentals.find(
      (rental) =>
        rental.status === RentalStatus.pending || rental.status === RentalStatus.active,
    );
  }, [rentalsQuery.data?.rentals]);

  const rentalHistory = useMemo(() => {
    return (rentalsQuery.data?.rentals ?? []).filter(
      (rental) =>
        !(
          rental.status === RentalStatus.pending ||
          rental.status === RentalStatus.active
        ),
    );
  }, [rentalsQuery.data?.rentals]);

  if (!safeCartId) {
    return (
      <StaffPageLayout title="Cart Detail" subtitle="Invalid cart id." currentPath="/carts">
        <PageError message="Cart id is missing from the route." />
      </StaffPageLayout>
    );
  }

  const isLoading = cartQuery.isLoading || rentalsQuery.isLoading;
  const isError = cartQuery.isError || rentalsQuery.isError;

  return (
    <StaffPageLayout
      title="Cart Detail"
      subtitle="Inspect cart status, current assignment, and rental history."
      currentPath="/carts"
      headingSlot={
        <Button asChild variant="outline">
          <Link to="/carts">
            <ArrowLeft className="h-4 w-4" />
            Back to Carts
          </Link>
        </Button>
      }
    >
      {isError ? (
        <PageError
          message={
            cartQuery.error instanceof Error
              ? cartQuery.error.message
              : rentalsQuery.error instanceof Error
                ? rentalsQuery.error.message
                : 'Unable to load cart details.'
          }
          onRetry={() => {
            void cartQuery.refetch();
            void rentalsQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : cartQuery.data ? (
        <>
          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Cart Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Label</p>
                <p className="mt-1 text-sm text-foreground">{cartQuery.data.label}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge type="cart" status={cartQuery.data.status} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="mt-1 text-sm text-foreground">{formatDateTime(cartQuery.data.updatedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="mt-1 text-sm text-foreground">
                  {cartQuery.data.year ? String(cartQuery.data.year) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Color</p>
                <p className="mt-1 text-sm text-foreground">{cartQuery.data.color ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm text-foreground">{cartQuery.data.notes ?? '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Current Rental</CardTitle>
            </CardHeader>
            <CardContent>
              {currentRental ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1">
                      <StatusBadge type="rental" status={currentRental.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatStatusLabel(currentRental.type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start</p>
                    <p className="mt-1 text-sm text-foreground">{formatDate(currentRental.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End</p>
                    <p className="mt-1 text-sm text-foreground">{formatDate(currentRental.endDate)}</p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  heading="No active or pending rental"
                  subtext="This cart is currently unassigned."
                  icon={CalendarClock}
                  className="min-h-[160px]"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Rental History</CardTitle>
            </CardHeader>
            <CardContent>
              {rentalHistory.length === 0 ? (
                <EmptyState
                  heading="No rental history yet"
                  subtext="Completed or cancelled rentals for this cart will appear here."
                  className="min-h-[180px]"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                        Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                        Type
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                        Start
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                        End
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                        Total
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentalHistory.map((rental) => (
                      <TableRow key={rental.id} className="hover:bg-[var(--color-background-muted)]">
                        <TableCell className="px-4 py-3">
                          <StatusBadge type="rental" status={rental.status} />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {formatStatusLabel(rental.type)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(rental.startDate)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(rental.endDate)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {formatCurrency(rental.totalAmount)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/rentals/${rental.id}`}>View Rental</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <PageError message="Cart not found." />
      )}
    </StaffPageLayout>
  );
}

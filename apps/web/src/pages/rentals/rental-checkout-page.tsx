import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Car, Loader2, MapPin, User } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RentalStatus } from 'shared';
import { PageError } from '@/components/common/page-error';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, formatStatusLabel } from '@/lib/format';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import { checkoutRental, getRentalById } from '@/services/rentals-service';

export function RentalCheckoutPage() {
  const { id: rentalId } = useParams<{ id: string }>();
  const safeRentalId = rentalId ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const rentalQuery = useQuery({
    queryKey: ['rental', safeRentalId],
    queryFn: () => getRentalById(safeRentalId),
    enabled: safeRentalId.length > 0,
  });

  const rental = rentalQuery.data;

  const checkoutMutation = useMutation({
    mutationFn: () => checkoutRental(safeRentalId),
    onSuccess: async () => {
      showSuccessToast('Cart checked out. Rental is now active.');
      await queryClient.invalidateQueries({ queryKey: ['rental', safeRentalId] });
      await queryClient.invalidateQueries({ queryKey: ['rentals'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/rentals/${safeRentalId}`, { replace: true });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Checkout failed. Please try again.';
      showErrorToast(message);
    },
  });

  if (!safeRentalId) {
    return (
      <StaffPageLayout title="Checkout" subtitle="Invalid rental id." currentPath="/rentals">
        <PageError message="Rental id is missing from the route." />
      </StaffPageLayout>
    );
  }

  const isAlreadyActive =
    rental && rental.status !== RentalStatus.pending;

  return (
    <StaffPageLayout
      title="Checkout Cart"
      subtitle="Confirm checkout to hand the cart to the customer and activate the rental."
      currentPath="/rentals"
      headingSlot={
        <Button asChild variant="outline" size="sm">
          <Link to={`/rentals/${safeRentalId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Rental
          </Link>
        </Button>
      }
    >
      {rentalQuery.isError ? (
        <PageError
          message={
            rentalQuery.error instanceof Error
              ? rentalQuery.error.message
              : 'Unable to load rental details.'
          }
          onRetry={() => void rentalQuery.refetch()}
        />
      ) : rentalQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rental ? (
        <div className="space-y-6">
          <Card className="border border-border bg-background shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-medium">Rental Summary</CardTitle>
                <StatusBadge type="rental" status={rental.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{rental.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{rental.customer.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cart</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{rental.cart.label}</p>
                    <StatusBadge type="cart" status={rental.cart.status} className="mt-1" />
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{rental.location.name}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                      <p className="mt-0.5 text-sm text-foreground">{formatStatusLabel(rental.type)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Date</p>
                    <p className="mt-0.5 text-sm text-foreground">{formatDate(rental.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">End Date</p>
                    <p className="mt-0.5 text-sm text-foreground">{formatDate(rental.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Amount</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{formatCurrency(rental.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAlreadyActive ? (
            <Card className="border border-border bg-background shadow-sm">
              <CardContent className="py-5">
                <p className="text-sm text-muted-foreground">
                  This rental is already in <strong>{formatStatusLabel(rental.status)}</strong>{' '}
                  status and cannot be checked out.{' '}
                  <Link
                    to={`/rentals/${rental.id}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Return to rental detail.
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm Checkout
              </Button>
              <Button asChild variant="outline">
                <Link to={`/rentals/${rental.id}`}>Cancel</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <PageError message="Rental not found." />
      )}
    </StaffPageLayout>
  );
}

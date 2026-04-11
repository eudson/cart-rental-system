import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageError } from '@/components/common/page-error';
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
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { formatCurrency, formatDate, formatDateTime, formatStatusLabel } from '@/lib/format';
import { getCustomerById } from '@/services/customers-service';
import { listRentals } from '@/services/rentals-service';

export function CustomerDetailPage() {
  const { id: customerId } = useParams<{ id: string }>();
  const safeCustomerId = customerId ?? '';

  const customerQuery = useQuery({
    queryKey: ['customer', safeCustomerId],
    queryFn: () => getCustomerById(safeCustomerId),
    enabled: safeCustomerId.length > 0,
  });

  const rentalsQuery = useQuery({
    queryKey: ['customer-rentals', safeCustomerId],
    queryFn: () =>
      listRentals({
        page: 1,
        pageSize: 50,
        customerId: safeCustomerId,
      }),
    enabled: safeCustomerId.length > 0,
  });

  if (!safeCustomerId) {
    return (
      <StaffPageLayout title="Customer Detail" subtitle="Invalid customer id." currentPath="/customers">
        <PageError message="Customer id is missing from the route." />
      </StaffPageLayout>
    );
  }

  const isLoading = customerQuery.isLoading || rentalsQuery.isLoading;
  const isError = customerQuery.isError || rentalsQuery.isError;
  const rentalHistory = rentalsQuery.data?.rentals ?? [];

  return (
    <StaffPageLayout
      title="Customer Detail"
      subtitle="View customer profile information and rental history."
      currentPath="/customers"
      headingSlot={
        <Button asChild variant="outline">
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
        </Button>
      }
    >
      {isError ? (
        <PageError
          message={
            customerQuery.error instanceof Error
              ? customerQuery.error.message
              : rentalsQuery.error instanceof Error
                ? rentalsQuery.error.message
                : 'Unable to load customer details.'
          }
          onRetry={() => {
            void customerQuery.refetch();
            void rentalsQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : customerQuery.data ? (
        <>
          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="mt-1 text-sm text-foreground">{customerQuery.data.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="mt-1 text-sm text-foreground">{customerQuery.data.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="mt-1 text-sm text-foreground">{customerQuery.data.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ID Number</p>
                <p className="mt-1 text-sm text-foreground">{customerQuery.data.idNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profile Updated</p>
                <p className="mt-1 text-sm text-foreground">{formatDateTime(customerQuery.data.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Rental History</CardTitle>
            </CardHeader>
            <CardContent>
              {rentalHistory.length === 0 ? (
                <EmptyState
                  heading="No rentals for this customer"
                  subtext="Rental records will appear here after bookings are created."
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
        <PageError message="Customer not found." />
      )}
    </StaffPageLayout>
  );
}

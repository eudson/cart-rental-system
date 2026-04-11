import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { RentalType } from 'shared';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StatusBadge } from '@/components/common/status-badge';
import { PortalLayout } from '@/components/layout/portal-layout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatStatusLabel,
} from '@/lib/format';
import {
  getPortalRentalById,
  getPortalRentalContract,
  listPortalRentalPayments,
} from '@/services/portal-service';

export function PortalRentalDetailPage() {
  const { id: rentalId } = useParams<{ id: string }>();
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(20);

  const rentalQuery = useQuery({
    queryKey: ['portal', 'rentals', rentalId],
    queryFn: () => getPortalRentalById(rentalId!),
    enabled: Boolean(rentalId),
  });

  const rental = rentalQuery.data;
  const isLease = rental?.type === RentalType.lease;

  const contractQuery = useQuery({
    queryKey: ['portal', 'rentals', rentalId, 'contract'],
    queryFn: () => getPortalRentalContract(rentalId!),
    enabled: Boolean(rentalId) && isLease,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ['portal', 'rentals', rentalId, 'payments', paymentsPage, paymentsPageSize],
    queryFn: () =>
      listPortalRentalPayments(rentalId!, { page: paymentsPage, pageSize: paymentsPageSize }),
    enabled: Boolean(rentalId),
  });

  if (rentalQuery.isError) {
    return (
      <PortalLayout>
        <PageError
          message="Rental not found or you do not have access to it."
          onRetry={() => rentalQuery.refetch()}
        />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <Link
          to="/portal/rentals"
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Rentals
        </Link>

        {rentalQuery.isPending ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Cart {rental?.cart.label}
            </h1>
            {rental && <StatusBadge type="rental" status={rental.status} />}
          </div>
        )}
      </div>

      {/* ── Rental Summary ──────────────────────────────────────────────── */}
      <div className="mb-6 rounded-lg border border-border bg-background p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-foreground">Rental details</h2>

        {rentalQuery.isPending ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : rental ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatStatusLabel(rental.type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Location
              </dt>
              <dd className="mt-1 text-sm text-foreground">{rental.location.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Start date
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatDate(rental.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                End date
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatDate(rental.endDate)}</dd>
            </div>
            {rental.actualReturnDate && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actual return
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatDateTime(rental.actualReturnDate)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total amount
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {formatCurrency(rental.totalAmount)}
              </dd>
            </div>
            {rental.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-foreground">{rental.notes}</dd>
              </div>
            )}
          </dl>
        ) : null}
      </div>

      {/* ── Lease Contract ────────────────────────────────────────────────── */}
      {isLease && (
        <div className="mb-6 rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">Lease contract</h2>
          </div>

          {contractQuery.isPending && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )}

          {contractQuery.isError && (
            <p className="text-sm text-muted-foreground">
              No lease contract on file for this rental.
            </p>
          )}

          {contractQuery.data && (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contract term
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {contractQuery.data.contractMonths} months
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Signed date
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatDate(contractQuery.data.signedAt)}
                </dd>
              </div>
              {contractQuery.data.earlyTerminationFee && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Early termination fee
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatCurrency(contractQuery.data.earlyTerminationFee)}
                  </dd>
                </div>
              )}
              {contractQuery.data.documentUrl && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Document
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={contractQuery.data.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground underline hover:text-accent"
                    >
                      View document
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* ── Payments ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-background shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-medium text-foreground">Payment records</h2>
        </div>

        {paymentsQuery.isError && (
          <PageError
            message="Failed to load payment records."
            onRetry={() => paymentsQuery.refetch()}
          />
        )}

        {paymentsQuery.isPending && (
          <div className="space-y-2 p-5">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded" />
            ))}
          </div>
        )}

        {!paymentsQuery.isPending && !paymentsQuery.isError && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Method
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(paymentsQuery.data?.payments ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8">
                      <EmptyState
                        heading="No payments recorded"
                        subtext="Payment records will appear here once they are added."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentsQuery.data?.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="px-4 py-3 text-sm">
                        {formatDate(payment.paidAt ?? payment.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {formatStatusLabel(payment.method)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge type="payment" status={payment.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {paymentsQuery.data?.pagination &&
              (paymentsQuery.data.payments ?? []).length > 0 && (
                <div className="px-5 py-4">
                  <PaginationControls
                    pagination={paymentsQuery.data.pagination}
                    onPageChange={setPaymentsPage}
                    onPageSizeChange={(size) => {
                      setPaymentsPageSize(size);
                      setPaymentsPage(1);
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

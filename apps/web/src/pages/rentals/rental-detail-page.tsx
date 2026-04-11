import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  PaymentMethod,
  PaymentStatus,
  type CreateRentalPaymentRequestDto,
} from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import {
  createRentalPayment,
  getRentalById,
  listRentalPayments,
} from '@/services/rentals-service';

interface PaymentFormState {
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  notes: string;
}

const INITIAL_PAYMENT_FORM: PaymentFormState = {
  amount: '',
  method: PaymentMethod.card,
  status: PaymentStatus.paid,
  paidAt: '',
  notes: '',
};

export function RentalDetailPage() {
  const { id: rentalId } = useParams<{ id: string }>();
  const safeRentalId = rentalId ?? '';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(INITIAL_PAYMENT_FORM);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);

  const rentalQuery = useQuery({
    queryKey: ['rental', safeRentalId],
    queryFn: () => getRentalById(safeRentalId),
    enabled: safeRentalId.length > 0,
  });

  const paymentsQuery = useQuery({
    queryKey: ['rental-payments', safeRentalId, page, pageSize, appliedSearch],
    queryFn: () =>
      listRentalPayments(safeRentalId, {
        page,
        pageSize,
        search: appliedSearch || undefined,
      }),
    enabled: safeRentalId.length > 0,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (dto: CreateRentalPaymentRequestDto) => createRentalPayment(safeRentalId, dto),
    onSuccess: async () => {
      showSuccessToast('Payment recorded successfully.');
      setPaymentForm(INITIAL_PAYMENT_FORM);
      setPaymentFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['rental-payments', safeRentalId] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Unable to record payment. Please try again.';

      setPaymentFormError(message);
      showErrorToast(message);
    },
  });

  function applyPaymentSearch() {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function resetPaymentSearch() {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  }

  function updatePaymentForm<Key extends keyof PaymentFormState>(
    field: Key,
    value: PaymentFormState[Key],
  ) {
    setPaymentForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(paymentForm.amount.trim());
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setPaymentFormError('Amount must be a positive number.');
      return;
    }

    const parsedPaidAt = paymentForm.paidAt ? new Date(paymentForm.paidAt) : null;
    if (parsedPaidAt && Number.isNaN(parsedPaidAt.getTime())) {
      setPaymentFormError('Paid date/time is invalid.');
      return;
    }

    setPaymentFormError(null);

    createPaymentMutation.mutate({
      amount: numericAmount,
      method: paymentForm.method,
      status: paymentForm.status,
      paidAt: parsedPaidAt ? parsedPaidAt.toISOString() : undefined,
      notes: paymentForm.notes.trim() || undefined,
    });
  }

  if (!safeRentalId) {
    return (
      <StaffPageLayout title="Rental Detail" subtitle="Invalid rental id." currentPath="/rentals">
        <PageError message="Rental id is missing from the route." />
      </StaffPageLayout>
    );
  }

  const isLoading = rentalQuery.isLoading || paymentsQuery.isLoading;
  const isError = rentalQuery.isError || paymentsQuery.isError;
  const payments = paymentsQuery.data?.payments ?? [];
  const pagination = paymentsQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Rental Detail"
      subtitle="Review rental summary and record manual payments."
      currentPath="/rentals"
      headingSlot={
        <Button asChild variant="outline">
          <Link to="/rentals">
            <ArrowLeft className="h-4 w-4" />
            Back to Rentals
          </Link>
        </Button>
      }
    >
      {isError ? (
        <PageError
          message={
            rentalQuery.error instanceof Error
              ? rentalQuery.error.message
              : paymentsQuery.error instanceof Error
                ? paymentsQuery.error.message
                : 'Unable to load rental details.'
          }
          onRetry={() => {
            void rentalQuery.refetch();
            void paymentsQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : rentalQuery.data ? (
        <>
          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Rental Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge type="rental" status={rentalQuery.data.status} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="mt-1 text-sm text-foreground">
                  {formatStatusLabel(rentalQuery.data.type)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(rentalQuery.data.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(rentalQuery.data.endDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="mt-1 text-sm text-foreground">{formatCurrency(rentalQuery.data.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual Return</p>
                <p className="mt-1 text-sm text-foreground">
                  {formatDateTime(rentalQuery.data.actualReturnDate)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Record Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePaymentSubmit}>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Amount *
                    </label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) => updatePaymentForm('amount', event.target.value)}
                      disabled={createPaymentMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Method *
                    </label>
                    <Select
                      value={paymentForm.method}
                      onValueChange={(value) =>
                        updatePaymentForm('method', value as PaymentMethod)
                      }
                      disabled={createPaymentMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PaymentMethod.cash}>Cash</SelectItem>
                        <SelectItem value={PaymentMethod.card}>Card</SelectItem>
                        <SelectItem value={PaymentMethod.bank_transfer}>Bank Transfer</SelectItem>
                        <SelectItem value={PaymentMethod.other}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </label>
                    <Select
                      value={paymentForm.status}
                      onValueChange={(value) =>
                        updatePaymentForm('status', value as PaymentStatus)
                      }
                      disabled={createPaymentMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PaymentStatus.unpaid}>Unpaid</SelectItem>
                        <SelectItem value={PaymentStatus.partial}>Partial</SelectItem>
                        <SelectItem value={PaymentStatus.paid}>Paid</SelectItem>
                        <SelectItem value={PaymentStatus.refunded}>Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Paid At
                    </label>
                    <Input
                      type="datetime-local"
                      value={paymentForm.paidAt}
                      onChange={(event) => updatePaymentForm('paidAt', event.target.value)}
                      disabled={createPaymentMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(event) => updatePaymentForm('notes', event.target.value)}
                      disabled={createPaymentMutation.isPending}
                    />
                  </div>
                </div>

                {paymentFormError ? <p className="text-xs text-destructive">{paymentFormError}</p> : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={createPaymentMutation.isPending}>
                    {createPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Record Payment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Payment Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px] flex-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Search
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Search by notes or status terms"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          applyPaymentSearch();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={applyPaymentSearch}>
                      <Search className="h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
                <Button type="button" variant="ghost" onClick={resetPaymentSearch}>
                  Reset
                </Button>
              </div>

              {payments.length === 0 ? (
                <EmptyState
                  heading="No payments recorded"
                  subtext="Use the form above to record the first payment for this rental."
                  className="min-h-[180px]"
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                          Status
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                          Method
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                          Amount
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                          Paid At
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                          Notes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-[var(--color-background-muted)]">
                          <TableCell className="px-4 py-3">
                            <StatusBadge type="payment" status={payment.status} />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-foreground">
                            {formatStatusLabel(payment.method)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-foreground">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDateTime(payment.paidAt)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                            {payment.notes ?? '—'}
                          </TableCell>
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
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <PageError message="Rental not found." />
      )}
    </StaffPageLayout>
  );
}

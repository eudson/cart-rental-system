import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RentalType, type Cart, type CreateRentalRequestDto, type Customer } from 'shared';

import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { StatusBadge } from '@/components/common/status-badge';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatStatusLabel } from '@/lib/format';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import { listAvailableCarts } from '@/services/carts-service';
import { listCartTypes } from '@/services/cart-types-service';
import { listCustomers } from '@/services/customers-service';
import { listLocations } from '@/services/locations-service';
import { createRental } from '@/services/rentals-service';

type FlowStep = 1 | 2 | 3 | 4;

interface RentalFormState {
  type: RentalType;
  startDate: string;
  endDate: string;
  contractMonths: string;
  locationId: string;
  notes: string;
}

const INITIAL_FORM_STATE: RentalFormState = {
  type: RentalType.daily,
  startDate: '',
  endDate: '',
  contractMonths: '6',
  locationId: 'all',
  notes: '',
};

function toStartOfDayIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function calculateLeaseEndDateIso(startDate: string, contractMonths: number): string {
  const parsedStartDate = new Date(toStartOfDayIso(startDate));
  parsedStartDate.setUTCMonth(parsedStartDate.getUTCMonth() + contractMonths);
  return parsedStartDate.toISOString();
}

function buildAvailabilityWindow(form: RentalFormState): { startDate: string; endDate: string } | null {
  if (!form.startDate) {
    return null;
  }

  if (form.type === RentalType.daily) {
    if (!form.endDate) {
      return null;
    }

    return {
      startDate: toStartOfDayIso(form.startDate),
      endDate: toStartOfDayIso(form.endDate),
    };
  }

  const contractMonths = Number(form.contractMonths);
  if (!Number.isInteger(contractMonths) || contractMonths <= 0) {
    return null;
  }

  return {
    startDate: toStartOfDayIso(form.startDate),
    endDate: calculateLeaseEndDateIso(form.startDate, contractMonths),
  };
}

export function NewRentalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [appliedCustomerSearch, setAppliedCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [rentalForm, setRentalForm] = useState<RentalFormState>(INITIAL_FORM_STATE);
  const [availabilityResults, setAvailabilityResults] = useState<Cart[]>([]);
  const [flowError, setFlowError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ['rental-flow', 'customers', appliedCustomerSearch],
    queryFn: () =>
      listCustomers({
        page: 1,
        pageSize: 50,
        search: appliedCustomerSearch || undefined,
      }),
  });

  const locationsQuery = useQuery({
    queryKey: ['rental-flow', 'locations'],
    queryFn: () => listLocations({ page: 1, pageSize: 100 }),
  });

  const cartTypesQuery = useQuery({
    queryKey: ['rental-flow', 'cart-types'],
    queryFn: () => listCartTypes({ page: 1, pageSize: 100 }),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => {
      const availabilityWindow = buildAvailabilityWindow(rentalForm);

      if (!availabilityWindow) {
        throw new Error(
          rentalForm.type === RentalType.daily
            ? 'Start date and end date are required for daily rentals.'
            : 'Start date and contract months are required for lease rentals.',
        );
      }

      return listAvailableCarts({
        type: rentalForm.type,
        startDate: availabilityWindow.startDate,
        endDate: availabilityWindow.endDate,
        locationId: rentalForm.locationId !== 'all' ? rentalForm.locationId : undefined,
      });
    },
    onSuccess: (carts) => {
      setAvailabilityResults(carts);
      setSelectedCartId(carts[0]?.id ?? null);
      setCurrentStep(3);
      setFlowError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to check availability.';
      setFlowError(message);
      showErrorToast(message);
    },
  });

  const createRentalMutation = useMutation({
    mutationFn: (dto: CreateRentalRequestDto) => createRental(dto),
    onSuccess: async (rental) => {
      showSuccessToast('Rental created successfully.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rentals'] }),
        queryClient.invalidateQueries({ queryKey: ['carts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      navigate(`/rentals/${rental.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to create rental.';
      setFlowError(message);
      showErrorToast(message);
    },
  });

  const selectedCustomer = useMemo(
    () =>
      (customersQuery.data?.customers ?? []).find((customer) => customer.id === selectedCustomerId) ??
      null,
    [customersQuery.data?.customers, selectedCustomerId],
  );

  const selectedCart = useMemo(
    () => availabilityResults.find((cart) => cart.id === selectedCartId) ?? null,
    [availabilityResults, selectedCartId],
  );

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const location of locationsQuery.data?.locations ?? []) {
      map.set(location.id, location.name);
    }
    return map;
  }, [locationsQuery.data?.locations]);

  const cartTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cartType of cartTypesQuery.data?.cartTypes ?? []) {
      map.set(cartType.id, cartType.name);
    }
    return map;
  }, [cartTypesQuery.data?.cartTypes]);

  function applyCustomerSearch() {
    setAppliedCustomerSearch(customerSearchInput.trim());
  }

  function updateForm<Key extends keyof RentalFormState>(field: Key, value: RentalFormState[Key]) {
    setRentalForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setSelectedCartId(null);
    setAvailabilityResults([]);
  }

  function goToStepTwo() {
    if (!selectedCustomerId) {
      setFlowError('Select a customer before continuing.');
      return;
    }

    setFlowError(null);
    setCurrentStep(2);
  }

  function runAvailabilityCheck() {
    const availabilityWindow = buildAvailabilityWindow(rentalForm);

    if (!selectedCustomerId) {
      setFlowError('Select a customer before checking availability.');
      return;
    }

    if (!availabilityWindow) {
      setFlowError(
        rentalForm.type === RentalType.daily
          ? 'Start date and end date are required for daily rentals.'
          : 'Start date and contract months are required for lease rentals.',
      );
      return;
    }

    if (availabilityWindow.startDate >= availabilityWindow.endDate) {
      setFlowError('The rental end date must be after the start date.');
      return;
    }

    setFlowError(null);
    availabilityMutation.mutate();
  }

  function goToConfirmStep() {
    if (!selectedCartId) {
      setFlowError('Select an available cart before continuing.');
      return;
    }

    setFlowError(null);
    setCurrentStep(4);
  }

  function submitRental() {
    if (!selectedCustomerId || !selectedCartId) {
      setFlowError('Customer and cart selection are required.');
      return;
    }

    const availabilityWindow = buildAvailabilityWindow(rentalForm);
    if (!availabilityWindow) {
      setFlowError('Rental timing is incomplete.');
      return;
    }

    createRentalMutation.mutate({
      type: rentalForm.type,
      customerId: selectedCustomerId,
      cartId: selectedCartId,
      startDate: availabilityWindow.startDate,
      endDate: rentalForm.type === RentalType.daily ? availabilityWindow.endDate : undefined,
      contractMonths:
        rentalForm.type === RentalType.lease ? Number(rentalForm.contractMonths) : undefined,
      notes: rentalForm.notes.trim() || undefined,
    });
  }

  const availabilityWindow = buildAvailabilityWindow(rentalForm);
  const stepTitle =
    currentStep === 1
      ? 'Select Customer'
      : currentStep === 2
        ? 'Set Rental Window'
        : currentStep === 3
          ? 'Choose Cart'
          : 'Confirm Rental';

  return (
    <StaffPageLayout
      title="New Rental"
      subtitle="Create a daily rental or lease by selecting a customer, checking availability, and confirming the cart."
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="border border-border bg-background shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Step {currentStep} of 4 · {stepTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {currentStep === 1 ? (
                <>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Search Customers
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        value={customerSearchInput}
                        onChange={(event) => setCustomerSearchInput(event.target.value)}
                        placeholder="Search by customer name or email"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applyCustomerSearch();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={applyCustomerSearch}>
                        <Search className="h-4 w-4" />
                        Apply
                      </Button>
                    </div>
                  </div>

                  {customersQuery.isError ? (
                    <PageError
                      message={
                        customersQuery.error instanceof Error
                          ? customersQuery.error.message
                          : 'Unable to load customers.'
                      }
                      onRetry={() => customersQuery.refetch()}
                    />
                  ) : customersQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : (customersQuery.data?.customers ?? []).length === 0 ? (
                    <EmptyState
                      heading="No customers found"
                      subtext="Adjust the search or create a customer before starting a rental."
                      className="min-h-[240px]"
                    />
                  ) : (
                    <div className="space-y-3">
                      {(customersQuery.data?.customers ?? []).map((customer: Customer) => {
                        const isSelected = selectedCustomerId === customer.id;

                        return (
                          <button
                            key={customer.id}
                            type="button"
                            className={`w-full rounded-lg border p-4 text-left transition ${
                              isSelected
                                ? 'border-primary bg-secondary'
                                : 'border-border bg-background hover:bg-[var(--color-background-subtle)]'
                            }`}
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setFlowError(null);
                            }}
                          >
                            <p className="text-sm font-medium text-foreground">{customer.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{customer.phone || 'No phone on file'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button type="button" onClick={goToStepTwo}>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Rental Type
                      </label>
                      <Select
                        value={rentalForm.type}
                        onValueChange={(value) => updateForm('type', value as RentalType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={RentalType.daily}>Daily</SelectItem>
                          <SelectItem value={RentalType.lease}>Lease</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Location
                      </label>
                      <Select
                        value={rentalForm.locationId}
                        onValueChange={(value) => updateForm('locationId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any location</SelectItem>
                          {(locationsQuery.data?.locations ?? []).map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={rentalForm.startDate}
                        onChange={(event) => updateForm('startDate', event.target.value)}
                      />
                    </div>

                    {rentalForm.type === RentalType.daily ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={rentalForm.endDate}
                          onChange={(event) => updateForm('endDate', event.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Contract Months
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={rentalForm.contractMonths}
                          onChange={(event) => updateForm('contractMonths', event.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {rentalForm.type === RentalType.lease && availabilityWindow ? (
                    <p className="text-sm text-muted-foreground">
                      Lease end date preview: {formatDate(availabilityWindow.endDate)}
                    </p>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </label>
                    <Input
                      value={rentalForm.notes}
                      onChange={(event) => updateForm('notes', event.target.value)}
                      placeholder="Optional booking notes"
                    />
                  </div>

                  <div className="flex justify-between gap-3">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button type="button" onClick={runAvailabilityCheck} disabled={availabilityMutation.isPending}>
                      {availabilityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Check Availability
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
                  {availabilityResults.length === 0 ? (
                    <EmptyState
                      heading="No available carts"
                      subtext="Adjust the rental window or location filter and check again."
                      className="min-h-[240px]"
                    />
                  ) : (
                    <div className="space-y-3">
                      {availabilityResults.map((cart) => {
                        const isSelected = selectedCartId === cart.id;
                        return (
                          <button
                            key={cart.id}
                            type="button"
                            className={`w-full rounded-lg border p-4 text-left transition ${
                              isSelected
                                ? 'border-primary bg-secondary'
                                : 'border-border bg-background hover:bg-[var(--color-background-subtle)]'
                            }`}
                            onClick={() => {
                              setSelectedCartId(cart.id);
                              setFlowError(null);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{cart.label}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {cartTypeNameById.get(cart.cartTypeId) ?? 'Unknown type'} · {locationNameById.get(cart.locationId) ?? 'Unknown location'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {cart.year ? `Year ${cart.year}` : 'Year unknown'}{cart.color ? ` · ${cart.color}` : ''}
                                </p>
                              </div>
                              <StatusBadge type="cart" status={cart.status} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between gap-3">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)}>
                      Back
                    </Button>
                    <Button type="button" onClick={goToConfirmStep} disabled={availabilityResults.length === 0}>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-[var(--color-background-subtle)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{selectedCustomer?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">{selectedCustomer?.email ?? '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-[var(--color-background-subtle)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cart</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{selectedCart?.label ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCart
                          ? `${cartTypeNameById.get(selectedCart.cartTypeId) ?? 'Unknown type'} · ${locationNameById.get(selectedCart.locationId) ?? 'Unknown location'}`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-[var(--color-background-subtle)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rental Window</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{formatDate(availabilityWindow?.startDate ?? null)}</p>
                      <p className="text-sm text-muted-foreground">to {formatDate(availabilityWindow?.endDate ?? null)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-[var(--color-background-subtle)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{formatStatusLabel(rentalForm.type)}</p>
                      <p className="text-sm text-muted-foreground">
                        {rentalForm.type === RentalType.lease
                          ? `${rentalForm.contractMonths} month contract`
                          : 'Daily rental'}
                      </p>
                    </div>
                  </div>

                  {rentalForm.notes ? (
                    <div className="rounded-lg border border-border bg-[var(--color-background-subtle)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                      <p className="mt-2 text-sm text-foreground">{rentalForm.notes}</p>
                    </div>
                  ) : null}

                  <div className="flex justify-between gap-3">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)}>
                      Back
                    </Button>
                    <Button type="button" onClick={submitRental} disabled={createRentalMutation.isPending}>
                      {createRentalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Create Rental
                    </Button>
                  </div>
                </>
              ) : null}

              {flowError ? <p className="text-xs text-destructive">{flowError}</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border bg-background shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Selection Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
              <p className="mt-1 text-foreground">{selectedCustomer?.name ?? 'Not selected yet'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
              <p className="mt-1 text-foreground">{formatStatusLabel(rentalForm.type)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Window</p>
              <p className="mt-1 text-foreground">
                {availabilityWindow ? `${formatDate(availabilityWindow.startDate)} to ${formatDate(availabilityWindow.endDate)}` : 'Not set yet'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected Cart</p>
              <p className="mt-1 text-foreground">{selectedCart?.label ?? 'Not selected yet'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffPageLayout>
  );
}
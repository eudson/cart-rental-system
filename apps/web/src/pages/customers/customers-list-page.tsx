import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CreateCustomerRequestDto } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { ApiClientError } from '@/services/api-client';
import { createCustomer, listCustomers } from '@/services/customers-service';
import { toast } from 'sonner';

interface CreateCustomerFormState {
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  password: string;
}

const INITIAL_CREATE_FORM: CreateCustomerFormState = {
  name: '',
  email: '',
  phone: '',
  idNumber: '',
  password: '',
};

export function CustomersListPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCustomerFormState>(INITIAL_CREATE_FORM);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ['customers', page, pageSize, appliedSearch],
    queryFn: () =>
      listCustomers({
        page,
        pageSize,
        search: appliedSearch || undefined,
      }),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (dto: CreateCustomerRequestDto) => createCustomer(dto),
    onSuccess: async () => {
      toast.success('Customer created successfully.');
      setCreateForm(INITIAL_CREATE_FORM);
      setCreateFormError(null);
      setIsCreateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Unable to create customer. Please try again.';

      setCreateFormError(message);
      toast.error(message, { duration: 8000, closeButton: true });
    },
  });

  function applySearch() {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  }

  function updateCreateForm<Key extends keyof CreateCustomerFormState>(
    field: Key,
    value: CreateCustomerFormState[Key],
  ) {
    setCreateForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleCreateCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateFormError('Name, email, and password are required.');
      return;
    }

    if (createForm.password.trim().length < 8) {
      setCreateFormError('Password must be at least 8 characters.');
      return;
    }

    setCreateFormError(null);
    createCustomerMutation.mutate({
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      phone: createForm.phone.trim() || undefined,
      idNumber: createForm.idNumber.trim() || undefined,
      password: createForm.password.trim(),
    });
  }

  const customers = customersQuery.data?.customers ?? [];
  const pagination = customersQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Customers"
      subtitle="Search customers and manage profiles for rental operations."
      currentPath="/customers"
      headingSlot={
        <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Customer
        </Button>
      }
    >
      <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, email, phone, or ID number"
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

          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      {customersQuery.isError ? (
        <PageError
          message={customersQuery.error instanceof Error ? customersQuery.error.message : 'Unable to load customers.'}
          onRetry={() => customersQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {customersQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              heading="No customers found"
              subtext="Adjust your search or create a new customer profile."
              action={
                <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
                  Create Customer
                </Button>
              }
              className="min-h-[220px]"
            />
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Name
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Email
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Phone
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      ID Number
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Updated
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-[var(--color-background-muted)]">
                      <TableCell className="px-4 py-3 text-sm text-foreground">{customer.name}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{customer.email}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {customer.phone ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {customer.idNumber ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTime(customer.updatedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/customers/${customer.id}`}>View</Link>
                        </Button>
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
            </div>
          )}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Customer</DialogTitle>
            <DialogDescription>Add a customer profile for rentals and portal access.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateCustomerSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name *
                </label>
                <Input
                  value={createForm.name}
                  onChange={(event) => updateCreateForm('name', event.target.value)}
                  disabled={createCustomerMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email *
                </label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(event) => updateCreateForm('email', event.target.value)}
                  disabled={createCustomerMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phone
                </label>
                <Input
                  value={createForm.phone}
                  onChange={(event) => updateCreateForm('phone', event.target.value)}
                  disabled={createCustomerMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  ID Number
                </label>
                <Input
                  value={createForm.idNumber}
                  onChange={(event) => updateCreateForm('idNumber', event.target.value)}
                  disabled={createCustomerMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password *
              </label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => updateCreateForm('password', event.target.value)}
                disabled={createCustomerMutation.isPending}
              />
            </div>

            {createFormError ? <p className="text-xs text-destructive">{createFormError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createCustomerMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </StaffPageLayout>
  );
}

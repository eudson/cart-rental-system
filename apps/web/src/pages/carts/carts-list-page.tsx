import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CartStatus, UserRole, type CreateCartRequestDto } from 'shared';
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
import { formatDateTime } from '@/lib/format';
import { ApiClientError } from '@/services/api-client';
import { listCartTypes } from '@/services/cart-types-service';
import { createCart, listCarts } from '@/services/carts-service';
import { listLocations } from '@/services/locations-service';
import { useAuthStore } from '@/store/auth-store';
import { StatusBadge } from '@/components/common/status-badge';
import { toast } from 'sonner';

type CartStatusFilter = CartStatus | 'all';

interface CreateCartFormState {
  locationId: string;
  cartTypeId: string;
  label: string;
  year: string;
  color: string;
  notes: string;
  status: CartStatus;
}

const INITIAL_CREATE_FORM: CreateCartFormState = {
  locationId: '',
  cartTypeId: '',
  label: '',
  year: '',
  color: '',
  notes: '',
  status: CartStatus.available,
};

export function CartsListPage() {
  const queryClient = useQueryClient();
  const sessionRole = useAuthStore((state) => state.sessionRole);
  const canCreateCart = sessionRole === UserRole.org_admin || sessionRole === UserRole.super_admin;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CartStatusFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCartFormState>(INITIAL_CREATE_FORM);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  const cartsQuery = useQuery({
    queryKey: ['carts', page, pageSize, appliedSearch, statusFilter, locationFilter],
    queryFn: () =>
      listCarts({
        page,
        pageSize,
        search: appliedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        locationId: locationFilter !== 'all' ? locationFilter : undefined,
      }),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'cart-filters'],
    queryFn: () => listLocations({ page: 1, pageSize: 100 }),
  });

  const cartTypesQuery = useQuery({
    queryKey: ['cart-types', 'cart-filters'],
    queryFn: () => listCartTypes({ page: 1, pageSize: 100 }),
  });

  const createCartMutation = useMutation({
    mutationFn: (dto: CreateCartRequestDto) => createCart(dto),
    onSuccess: async () => {
      toast.success('Cart registered successfully.');
      setIsCreateDialogOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      setCreateFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['carts'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Unable to create cart. Please try again.';

      setCreateFormError(message);
      toast.error(message, { duration: 8000, closeButton: true });
    },
  });

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

  function applySearch() {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('all');
    setLocationFilter('all');
    setPage(1);
  }

  function updateCreateForm<Key extends keyof CreateCartFormState>(
    field: Key,
    value: CreateCartFormState[Key],
  ) {
    setCreateForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleCreateCartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createForm.locationId || !createForm.cartTypeId || !createForm.label.trim()) {
      setCreateFormError('Location, cart type, and cart label are required.');
      return;
    }

    const parsedYear = createForm.year.trim() ? Number(createForm.year.trim()) : undefined;
    if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear <= 0)) {
      setCreateFormError('Year must be a positive whole number.');
      return;
    }

    setCreateFormError(null);

    createCartMutation.mutate({
      locationId: createForm.locationId,
      cartTypeId: createForm.cartTypeId,
      label: createForm.label.trim(),
      year: parsedYear,
      color: createForm.color.trim() || undefined,
      notes: createForm.notes.trim() || undefined,
      status: createForm.status,
    });
  }

  const isListLoading = cartsQuery.isLoading;
  const isListError = cartsQuery.isError;
  const carts = cartsQuery.data?.carts ?? [];
  const pagination = cartsQuery.data?.pagination;

  const headingSlot = canCreateCart ? (
    <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
      <Plus className="h-4 w-4" />
      Register Cart
    </Button>
  ) : undefined;

  return (
    <StaffPageLayout
      title="Carts"
      subtitle="Track cart inventory, availability status, and assignments by location."
      currentPath="/carts"
      headingSlot={headingSlot}
    >
      <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by label, color, or notes"
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
              Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as CartStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value={CartStatus.available}>Available</SelectItem>
                <SelectItem value={CartStatus.reserved}>Reserved</SelectItem>
                <SelectItem value={CartStatus.rented}>Rented</SelectItem>
                <SelectItem value={CartStatus.retired}>Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Location
            </label>
            <Select
              value={locationFilter}
              onValueChange={(value) => {
                setLocationFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {(locationsQuery.data?.locations ?? []).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      {isListError ? (
        <PageError
          message={cartsQuery.error instanceof Error ? cartsQuery.error.message : 'Unable to load carts.'}
          onRetry={() => cartsQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {isListLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : carts.length === 0 ? (
            <EmptyState
              heading="No carts found"
              subtext="Adjust filters or register a new cart to get started."
              action={
                canCreateCart ? (
                  <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
                    Register Cart
                  </Button>
                ) : undefined
              }
              className="min-h-[220px]"
            />
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Label
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Location
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Cart Type
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
                  {carts.map((cart) => (
                    <TableRow key={cart.id} className="hover:bg-[var(--color-background-muted)]">
                      <TableCell className="px-4 py-3 text-sm text-foreground">{cart.label}</TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge type="cart" status={cart.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {locationNameById.get(cart.locationId) ?? 'Unknown location'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {cartTypeNameById.get(cart.cartTypeId) ?? 'Unknown cart type'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTime(cart.updatedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/carts/${cart.id}`}>View</Link>
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
            <DialogTitle>Register Cart</DialogTitle>
            <DialogDescription>Create a new cart record for this organization.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateCartSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Location *
                </label>
                <Select
                  value={createForm.locationId}
                  onValueChange={(value) => updateCreateForm('locationId', value)}
                  disabled={createCartMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locationsQuery.data?.locations ?? []).map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cart Type *
                </label>
                <Select
                  value={createForm.cartTypeId}
                  onValueChange={(value) => updateCreateForm('cartTypeId', value)}
                  disabled={createCartMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cart type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cartTypesQuery.data?.cartTypes ?? []).map((cartType) => (
                      <SelectItem key={cartType.id} value={cartType.id}>
                        {cartType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Label *
              </label>
              <Input
                value={createForm.label}
                onChange={(event) => updateCreateForm('label', event.target.value)}
                disabled={createCartMutation.isPending}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Year
                </label>
                <Input
                  type="number"
                  value={createForm.year}
                  onChange={(event) => updateCreateForm('year', event.target.value)}
                  disabled={createCartMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Color
                </label>
                <Input
                  value={createForm.color}
                  onChange={(event) => updateCreateForm('color', event.target.value)}
                  disabled={createCartMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Initial Status
                </label>
                <Select
                  value={createForm.status}
                  onValueChange={(value) => updateCreateForm('status', value as CartStatus)}
                  disabled={createCartMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CartStatus.available}>Available</SelectItem>
                    <SelectItem value={CartStatus.reserved}>Reserved</SelectItem>
                    <SelectItem value={CartStatus.rented}>Rented</SelectItem>
                    <SelectItem value={CartStatus.retired}>Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </label>
              <Input
                value={createForm.notes}
                onChange={(event) => updateCreateForm('notes', event.target.value)}
                disabled={createCartMutation.isPending}
              />
            </div>

            {createFormError ? <p className="text-xs text-destructive">{createFormError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createCartMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCartMutation.isPending}>
                {createCartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Register Cart
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </StaffPageLayout>
  );
}

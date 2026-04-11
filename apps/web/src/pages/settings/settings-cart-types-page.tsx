import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CartType } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { PaginationControls } from '@/components/common/pagination-controls';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { formatCurrency } from '@/lib/format';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import {
  createCartType,
  deleteCartType,
  listCartTypes,
  updateCartType,
  type CreateCartTypeBody,
  type UpdateCartTypeBody,
} from '@/services/cart-types-service';

interface CartTypeFormState {
  name: string;
  description: string;
  dailyRate: string;
  monthlyRate: string;
  seatingCapacity: string;
}

const INITIAL_FORM: CartTypeFormState = {
  name: '',
  description: '',
  dailyRate: '',
  monthlyRate: '',
  seatingCapacity: '',
};

function formToCreateBody(form: CartTypeFormState): CreateCartTypeBody {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    dailyRate: parseFloat(form.dailyRate),
    monthlyRate: parseFloat(form.monthlyRate),
    seatingCapacity: form.seatingCapacity ? parseInt(form.seatingCapacity, 10) : undefined,
  };
}

function formToUpdateBody(form: CartTypeFormState): UpdateCartTypeBody {
  return {
    name: form.name.trim() || undefined,
    description: form.description.trim() || undefined,
    dailyRate: form.dailyRate ? parseFloat(form.dailyRate) : undefined,
    monthlyRate: form.monthlyRate ? parseFloat(form.monthlyRate) : undefined,
    seatingCapacity: form.seatingCapacity ? parseInt(form.seatingCapacity, 10) : undefined,
  };
}

function validateForm(form: CartTypeFormState): string | null {
  if (!form.name.trim()) return 'Name is required.';
  const daily = parseFloat(form.dailyRate);
  if (!form.dailyRate || isNaN(daily) || daily < 0) return 'Daily rate must be a valid positive number.';
  const monthly = parseFloat(form.monthlyRate);
  if (!form.monthlyRate || isNaN(monthly) || monthly < 0) return 'Monthly rate must be a valid positive number.';
  return null;
}

export function SettingsCartTypesPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CartTypeFormState>(INITIAL_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingCartType, setEditingCartType] = useState<CartType | null>(null);
  const [editForm, setEditForm] = useState<CartTypeFormState>(INITIAL_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingCartType, setDeletingCartType] = useState<CartType | null>(null);

  const cartTypesQuery = useQuery({
    queryKey: ['cart-types', page, pageSize],
    queryFn: () => listCartTypes({ page, pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateCartTypeBody) => createCartType(body),
    onSuccess: async () => {
      showSuccessToast('Cart type created.');
      setCreateForm(INITIAL_FORM);
      setCreateError(null);
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['cart-types'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to create cart type.';
      setCreateError(message);
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCartTypeBody }) =>
      updateCartType(id, body),
    onSuccess: async () => {
      showSuccessToast('Cart type updated.');
      setEditingCartType(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ['cart-types'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to update cart type.';
      setEditError(message);
      showErrorToast(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCartType(id),
    onSuccess: async () => {
      showSuccessToast('Cart type deleted.');
      setDeletingCartType(null);
      await queryClient.invalidateQueries({ queryKey: ['cart-types'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to delete cart type.';
      showErrorToast(message);
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(createForm);
    if (validationError) { setCreateError(validationError); return; }
    setCreateError(null);
    createMutation.mutate(formToCreateBody(createForm));
  }

  function openEdit(cartType: CartType) {
    setEditingCartType(cartType);
    setEditForm({
      name: cartType.name,
      description: cartType.description ?? '',
      dailyRate: cartType.dailyRate,
      monthlyRate: cartType.monthlyRate,
      seatingCapacity: cartType.seatingCapacity ? String(cartType.seatingCapacity) : '',
    });
    setEditError(null);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCartType) return;
    const validationError = validateForm(editForm);
    if (validationError) { setEditError(validationError); return; }
    setEditError(null);
    updateMutation.mutate({ id: editingCartType.id, body: formToUpdateBody(editForm) });
  }

  const cartTypes = cartTypesQuery.data?.cartTypes ?? [];
  const pagination = cartTypesQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Cart Types"
      subtitle="Manage cart type definitions and pricing rates."
      currentPath="/settings/cart-types"
      headingSlot={
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Cart Type
        </Button>
      }
    >
      {cartTypesQuery.isError ? (
        <PageError
          message={
            cartTypesQuery.error instanceof Error
              ? cartTypesQuery.error.message
              : 'Unable to load cart types.'
          }
          onRetry={() => cartTypesQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {cartTypesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : cartTypes.length === 0 ? (
            <EmptyState
              heading="No cart types yet"
              subtext="Add a cart type to start registering carts."
              action={
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  Add Cart Type
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
                      Description
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Daily Rate
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Monthly Rate
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Seats
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartTypes.map((ct) => (
                    <TableRow key={ct.id} className="hover:bg-[var(--color-background-muted)]">
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                        {ct.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {ct.description ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">
                        {formatCurrency(ct.dailyRate)}/day
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">
                        {formatCurrency(ct.monthlyRate)}/mo
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {ct.seatingCapacity ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(ct)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeletingCartType(ct)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && (
                <PaginationControls
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={() => {}}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cart Type</DialogTitle>
            <DialogDescription>Define a new cart type with pricing rates.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1.5"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Standard 2-Seater"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </label>
              <Input
                className="mt-1.5"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Daily Rate ($) <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1.5"
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.dailyRate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dailyRate: e.target.value }))}
                  placeholder="45.00"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Monthly Rate ($) <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1.5"
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.monthlyRate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, monthlyRate: e.target.value }))}
                  placeholder="800.00"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Seating Capacity
              </label>
              <Input
                className="mt-1.5"
                type="number"
                min="1"
                value={createForm.seatingCapacity}
                onChange={(e) => setCreateForm((f) => ({ ...f, seatingCapacity: e.target.value }))}
                placeholder="2"
              />
            </div>
            {createError && <p className="text-xs text-red-500">{createError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateForm(INITIAL_FORM);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editingCartType}
        onOpenChange={(open) => { if (!open) { setEditingCartType(null); setEditError(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cart Type</DialogTitle>
            <DialogDescription>Update cart type details and pricing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1.5"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </label>
              <Input
                className="mt-1.5"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Daily Rate ($) <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1.5"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.dailyRate}
                  onChange={(e) => setEditForm((f) => ({ ...f, dailyRate: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Monthly Rate ($) <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1.5"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.monthlyRate}
                  onChange={(e) => setEditForm((f) => ({ ...f, monthlyRate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Seating Capacity
              </label>
              <Input
                className="mt-1.5"
                type="number"
                min="1"
                value={editForm.seatingCapacity}
                onChange={(e) => setEditForm((f) => ({ ...f, seatingCapacity: e.target.value }))}
              />
            </div>
            {editError && <p className="text-xs text-red-500">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditingCartType(null); setEditError(null); }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingCartType}
        onOpenChange={(open) => { if (!open) setDeletingCartType(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cart type?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingCartType?.name}</strong> will be permanently deleted. This action
              cannot be undone. Cart types with assigned carts cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingCartType && deleteMutation.mutate(deletingCartType.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StaffPageLayout>
  );
}

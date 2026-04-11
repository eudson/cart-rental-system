import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus } from 'lucide-react';
import type { Location } from 'shared';
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
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import {
  createLocation,
  listLocations,
  updateLocation,
  type CreateLocationBody,
  type UpdateLocationBody,
} from '@/services/locations-service';

interface CreateFormState {
  name: string;
  address: string;
  timezone: string;
}

const INITIAL_CREATE_FORM: CreateFormState = { name: '', address: '', timezone: 'UTC' };

interface EditFormState {
  name: string;
  address: string;
  timezone: string;
}

export function SettingsLocationsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(INITIAL_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', address: '', timezone: '' });
  const [editError, setEditError] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ['locations', page, pageSize],
    queryFn: () => listLocations({ page, pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateLocationBody) => createLocation(body),
    onSuccess: async () => {
      showSuccessToast('Location created.');
      setCreateForm(INITIAL_CREATE_FORM);
      setCreateError(null);
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to create location.';
      setCreateError(message);
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLocationBody }) =>
      updateLocation(id, body),
    onSuccess: async () => {
      showSuccessToast('Location updated.');
      setEditingLocation(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to update location.';
      setEditError(message);
      showErrorToast(message);
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Name is required.');
      return;
    }
    setCreateError(null);
    createMutation.mutate({
      name: createForm.name.trim(),
      address: createForm.address.trim() || undefined,
      timezone: createForm.timezone.trim() || undefined,
    });
  }

  function openEdit(location: Location) {
    setEditingLocation(location);
    setEditForm({
      name: location.name,
      address: location.address ?? '',
      timezone: location.timezone,
    });
    setEditError(null);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLocation) return;
    if (!editForm.name.trim()) {
      setEditError('Name is required.');
      return;
    }
    setEditError(null);
    updateMutation.mutate({
      id: editingLocation.id,
      body: {
        name: editForm.name.trim(),
        address: editForm.address.trim() || undefined,
        timezone: editForm.timezone.trim() || undefined,
      },
    });
  }

  const locations = locationsQuery.data?.locations ?? [];
  const pagination = locationsQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Locations"
      subtitle="Manage your organization's physical locations."
      currentPath="/settings/locations"
      headingSlot={
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      }
    >
      {locationsQuery.isError ? (
        <PageError
          message={
            locationsQuery.error instanceof Error
              ? locationsQuery.error.message
              : 'Unable to load locations.'
          }
          onRetry={() => locationsQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {locationsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : locations.length === 0 ? (
            <EmptyState
              heading="No locations yet"
              subtext="Add your first physical location."
              action={
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  Add Location
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
                      Address
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Timezone
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow
                      key={location.id}
                      className="hover:bg-[var(--color-background-muted)]"
                    >
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                        {location.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {location.address ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {location.timezone}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm capitalize text-muted-foreground">
                        {location.status}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(location)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
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
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>Create a new physical location for your organization.</DialogDescription>
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
                placeholder="Main Depot"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Address
              </label>
              <Input
                className="mt-1.5"
                value={createForm.address}
                onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="1 Fairway Drive"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Timezone
              </label>
              <Input
                className="mt-1.5"
                value={createForm.timezone}
                onChange={(e) => setCreateForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </div>
            {createError && <p className="text-xs text-red-500">{createError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateForm(INITIAL_CREATE_FORM);
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
      <Dialog open={!!editingLocation} onOpenChange={(open) => { if (!open) setEditingLocation(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update location details.</DialogDescription>
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
                Address
              </label>
              <Input
                className="mt-1.5"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Timezone
              </label>
              <Input
                className="mt-1.5"
                value={editForm.timezone}
                onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </div>
            {editError && <p className="text-xs text-red-500">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingLocation(null);
                  setEditError(null);
                }}
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
    </StaffPageLayout>
  );
}

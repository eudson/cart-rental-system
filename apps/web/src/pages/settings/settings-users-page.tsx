import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, UserX } from 'lucide-react';
import type { User } from 'shared';
import { UserRole } from 'shared';
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
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import {
  createUser,
  deactivateUser,
  listUsers,
  updateUser,
  type CreateUserBody,
  type UpdateUserBody,
} from '@/services/users-service';

const MANAGEABLE_ROLES = [UserRole.org_admin, UserRole.staff] as const;
type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

interface CreateFormState {
  name: string;
  email: string;
  password: string;
  role: ManageableRole;
}

const INITIAL_CREATE_FORM: CreateFormState = {
  name: '',
  email: '',
  password: '',
  role: UserRole.staff,
};

interface EditFormState {
  name: string;
  email: string;
  role: ManageableRole;
}

function roleLabel(role: string): string {
  switch (role) {
    case UserRole.org_admin: return 'Admin';
    case UserRole.staff: return 'Staff';
    default: return role;
  }
}

export function SettingsUsersPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(INITIAL_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', email: '', role: UserRole.staff });
  const [editError, setEditError] = useState<string | null>(null);

  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', page, pageSize],
    queryFn: () => listUsers({ page, pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: async () => {
      showSuccessToast('User created.');
      setCreateForm(INITIAL_CREATE_FORM);
      setCreateError(null);
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to create user.';
      setCreateError(message);
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) => updateUser(id, body),
    onSuccess: async () => {
      showSuccessToast('User updated.');
      setEditingUser(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to update user.';
      setEditError(message);
      showErrorToast(message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: async () => {
      showSuccessToast('User deactivated.');
      setDeactivatingUser(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to deactivate user.';
      showErrorToast(message);
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('Password must be at least 8 characters.');
      return;
    }
    setCreateError(null);
    createMutation.mutate({
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      role: createForm.role,
    });
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: (user.role === UserRole.org_admin ? UserRole.org_admin : UserRole.staff) as ManageableRole,
    });
    setEditError(null);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Name and email are required.');
      return;
    }
    setEditError(null);
    updateMutation.mutate({
      id: editingUser.id,
      body: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      },
    });
  }

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;

  return (
    <StaffPageLayout
      title="Users"
      subtitle="Manage staff and admin accounts for your organization."
      currentPath="/settings/users"
      headingSlot={
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      }
    >
      {usersQuery.isError ? (
        <PageError
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : 'Unable to load users.'
          }
          onRetry={() => usersQuery.refetch()}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          {usersQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              heading="No users found"
              subtext="Add staff and admin users to your organization."
              action={
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  Add User
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
                      Role
                    </TableHead>
                    <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      Status
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
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-[var(--color-background-muted)]">
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                        {user.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <Badge variant="outline">{roleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTime(user.updatedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {user.isActive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeactivatingUser(user)}
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          )}
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
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new staff or admin account.</DialogDescription>
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
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1.5"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1.5"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Role <span className="text-red-500">*</span>
              </label>
              <Select
                value={createForm.role}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, role: v as ManageableRole }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.staff}>Staff</SelectItem>
                  <SelectItem value={UserRole.org_admin}>Admin</SelectItem>
                </SelectContent>
              </Select>
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
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => { if (!open) { setEditingUser(null); setEditError(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role.</DialogDescription>
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
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1.5"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Role <span className="text-red-500">*</span>
              </label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as ManageableRole }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.staff}>Staff</SelectItem>
                  <SelectItem value={UserRole.org_admin}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-xs text-red-500">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditingUser(null); setEditError(null); }}
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

      {/* Deactivate confirmation */}
      <AlertDialog
        open={!!deactivatingUser}
        onOpenChange={(open) => { if (!open) setDeactivatingUser(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deactivatingUser?.name}</strong> will lose access to the system. Their data
              is preserved and the account can be re-activated by contacting support.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deactivatingUser && deactivateMutation.mutate(deactivatingUser.id)}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StaffPageLayout>
  );
}

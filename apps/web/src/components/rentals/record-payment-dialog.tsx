import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  PaymentMethod,
  PaymentStatus,
  type CreateRentalPaymentRequestDto,
} from 'shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { ApiClientError } from '@/services/api-client';
import { createRentalPayment } from '@/services/rentals-service';

interface PaymentFormState {
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  notes: string;
}

const INITIAL_FORM: PaymentFormState = {
  amount: '',
  method: PaymentMethod.card,
  status: PaymentStatus.paid,
  paidAt: '',
  notes: '',
};

interface RecordPaymentDialogProps {
  rentalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecordPaymentDialog({
  rentalId,
  open,
  onOpenChange,
  onSuccess,
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PaymentFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (dto: CreateRentalPaymentRequestDto) => createRentalPayment(rentalId, dto),
    onSuccess: async () => {
      showSuccessToast('Payment recorded successfully.');
      setForm(INITIAL_FORM);
      setFormError(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['rental-payments', rentalId] });
      await queryClient.invalidateQueries({ queryKey: ['rentals'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess?.();
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'Unable to record payment. Please try again.';
      setFormError(message);
      showErrorToast(message);
    },
  });

  function updateField<K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(form.amount.trim());
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }

    const parsedPaidAt = form.paidAt ? new Date(form.paidAt) : null;
    if (parsedPaidAt && Number.isNaN(parsedPaidAt.getTime())) {
      setFormError('Paid date/time is invalid.');
      return;
    }

    setFormError(null);
    mutation.mutate({
      amount: numericAmount,
      method: form.method,
      status: form.status,
      paidAt: parsedPaidAt ? parsedPaidAt.toISOString() : undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setForm(INITIAL_FORM);
      setFormError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amount *
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Method *
              </label>
              <Select
                value={form.method}
                onValueChange={(v) => updateField('method', v as PaymentMethod)}
                disabled={mutation.isPending}
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
                value={form.status}
                onValueChange={(v) => updateField('status', v as PaymentStatus)}
                disabled={mutation.isPending}
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
                value={form.paidAt}
                onChange={(e) => updateField('paidAt', e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </label>
              <Input
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

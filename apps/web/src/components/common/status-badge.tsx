import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CartStatus, PaymentStatus, RentalStatus } from 'shared';

const STATUS_COLOR_VARS = {
  cart: {
    [CartStatus.available]: 'var(--color-status-available)',
    [CartStatus.rented]: 'var(--color-status-rented)',
    [CartStatus.reserved]: 'var(--color-status-reserved)',
    [CartStatus.retired]: 'var(--color-status-retired)',
  },
  rental: {
    [RentalStatus.pending]: 'var(--color-status-pending)',
    [RentalStatus.active]: 'var(--color-status-active)',
    [RentalStatus.completed]: 'var(--color-status-completed)',
    [RentalStatus.cancelled]: 'var(--color-status-cancelled)',
  },
  payment: {
    [PaymentStatus.unpaid]: 'var(--color-status-unpaid)',
    [PaymentStatus.partial]: 'var(--color-status-partial)',
    [PaymentStatus.paid]: 'var(--color-status-paid)',
    [PaymentStatus.refunded]: 'var(--color-status-refunded)',
  },
} as const;

type StatusBadgeProps =
  | {
      type: 'cart';
      status: CartStatus;
      className?: string;
    }
  | {
      type: 'rental';
      status: RentalStatus;
      className?: string;
    }
  | {
      type: 'payment';
      status: PaymentStatus;
      className?: string;
    };

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function StatusBadge({ type, status, className }: StatusBadgeProps) {
  let color: string;

  if (type === 'cart') {
    color = STATUS_COLOR_VARS.cart[status];
  } else if (type === 'rental') {
    color = STATUS_COLOR_VARS.rental[status];
  } else {
    color = STATUS_COLOR_VARS.payment[status];
  }

  return (
    <Badge
      className={cn('border-0 font-medium capitalize', className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
      }}
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}

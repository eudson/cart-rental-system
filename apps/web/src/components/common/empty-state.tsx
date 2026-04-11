import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  heading: string;
  subtext: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  heading,
  subtext,
  icon: Icon = CircleDashed,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-[var(--color-background-subtle)] p-6 text-center',
        className,
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-medium">{heading}</h3>
      <p className="max-w-md text-xs text-muted-foreground">{subtext}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  headingSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageWrapper({
  title,
  subtitle,
  headingSlot,
  children,
  className,
}: PageWrapperProps) {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-6 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {headingSlot ? <div className="shrink-0">{headingSlot}</div> : null}
      </div>
      <div className={cn('space-y-6', className)}>{children}</div>
    </div>
  );
}

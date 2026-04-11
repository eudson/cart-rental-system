import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const currentCustomer = useAuthStore((state) => state.currentCustomer);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);

  return (
    <div className="min-h-screen bg-[var(--color-background-subtle)]">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {currentOrganization?.name ?? 'Golf Cart Rentals'}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <Link
              to="/portal/rentals"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              My Rentals
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {currentCustomer && (
              <span className="text-xs text-muted-foreground">{currentCustomer.name}</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAuthState}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}

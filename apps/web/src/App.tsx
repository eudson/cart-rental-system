import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { CartStatus, PaymentStatus, RentalStatus, UserRole } from 'shared';
import { EmptyState } from '@/components/common/empty-state';
import { PageError } from '@/components/common/page-error';
import { StatusBadge } from '@/components/common/status-badge';
import { AppLayout } from '@/components/layout/app-layout';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  const [showError, setShowError] = useState(false);

  const statusRows = useMemo(
    () => [
      {
        label: 'Cart Status',
        badge: <StatusBadge type="cart" status={CartStatus.available} />,
      },
      {
        label: 'Rental Status',
        badge: <StatusBadge type="rental" status={RentalStatus.active} />,
      },
      {
        label: 'Payment Status',
        badge: <StatusBadge type="payment" status={PaymentStatus.partial} />,
      },
    ],
    [],
  );

  return (
    <>
      <AppLayout
        pageTitle="Dashboard"
        currentPath="/dashboard"
        orgName="Demo Golf Carts"
        userName="Alex Johnson"
        userRole={UserRole.org_admin}
        actionSlot={
          <Button size="sm" title="Create a new rental">
            New Rental
          </Button>
        }
      >
        <PageWrapper
          title="Frontend Foundation"
          subtitle="Base layout and design-system primitives are now in place."
          headingSlot={
            <Button variant="outline" size="sm" onClick={() => setShowError((current) => !current)}>
              Toggle Error Example
            </Button>
          }
        >
          <Card>
            <CardHeader>
              <CardTitle>Status Badge Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm text-foreground">{row.label}</span>
                  {row.badge}
                </div>
              ))}
            </CardContent>
          </Card>

          <EmptyState
            icon={AlertCircle}
            heading="No rentals found"
            subtext="Create a rental to get started."
            action={
              <Button size="sm" title="Create your first rental">
                Create Rental
              </Button>
            }
          />

          {showError ? (
            <PageError
              message="The rental summary failed to load. Try again."
              onRetry={() => setShowError(false)}
            />
          ) : null}
        </PageWrapper>
      </AppLayout>
      <Toaster richColors={false} position="bottom-right" visibleToasts={1} />
    </>
  );
}

import { Building2, Calendar, DollarSign } from 'lucide-react';
import { StaffPageLayout } from '@/components/layout/staff-page-layout';
import { formatCurrency } from '@/lib/format';
import { useAuthStore } from '@/store/auth-store';

export function SettingsOrganizationPage() {
  const org = useAuthStore((state) => state.currentOrganization);

  if (!org) {
    return (
      <StaffPageLayout
        title="Organization Settings"
        subtitle="View your organization's configuration."
        currentPath="/settings/organization"
      >
        <p className="text-sm text-muted-foreground">No organization data available.</p>
      </StaffPageLayout>
    );
  }

  return (
    <StaffPageLayout
      title="Organization Settings"
      subtitle="View your organization's configuration and rental defaults."
      currentPath="/settings/organization"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Organization Details
            </h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </dt>
              <dd className="mt-1 text-sm text-foreground">{org.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Slug
              </dt>
              <dd className="mt-1 font-mono text-sm text-foreground">{org.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1 text-sm capitalize text-foreground">{org.status}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lease Settings
            </h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Minimum Lease Duration
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {org.minLeaseMonths} month{org.minLeaseMonths !== 1 ? 's' : ''}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Default Rates
            </h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default Daily Rate
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {org.defaultDailyRate ? formatCurrency(org.defaultDailyRate) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default Monthly Rate
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {org.defaultMonthlyRate ? formatCurrency(org.defaultMonthlyRate) : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-muted-foreground">
          Organization settings are managed by a platform administrator. Contact support to request
          changes.
        </p>
      </div>
    </StaffPageLayout>
  );
}

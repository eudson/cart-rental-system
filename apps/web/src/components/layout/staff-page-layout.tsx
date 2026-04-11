import type { ReactNode } from 'react';
import { UserRole } from 'shared';
import { AppLayout } from '@/components/layout/app-layout';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { useAuthStore } from '@/store/auth-store';

interface StaffPageLayoutProps {
  title: string;
  subtitle?: string;
  currentPath: string;
  headingSlot?: ReactNode;
  children: ReactNode;
}

export function StaffPageLayout({
  title,
  subtitle,
  currentPath,
  headingSlot,
  children,
}: StaffPageLayoutProps) {
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const currentUser = useAuthStore((state) => state.currentUser);
  const sessionRole = useAuthStore((state) => state.sessionRole);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);

  const userRole =
    currentUser?.role ??
    (sessionRole && sessionRole !== 'customer' ? sessionRole : UserRole.org_admin);

  return (
    <AppLayout
      pageTitle={title}
      currentPath={currentPath}
      orgName={currentOrganization?.name ?? 'Demo Golf Carts'}
      userName={currentUser?.name ?? 'Operations User'}
      userRole={userRole}
      onLogout={clearAuthState}
    >
      <PageWrapper title={title} subtitle={subtitle} headingSlot={headingSlot}>
        {children}
      </PageWrapper>
    </AppLayout>
  );
}

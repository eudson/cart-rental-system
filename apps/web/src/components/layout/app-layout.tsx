import type { ReactNode } from 'react';
import type { UserRole } from 'shared';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

interface AppLayoutProps {
  pageTitle: string;
  actionSlot?: ReactNode;
  currentPath?: string;
  userRole: UserRole;
  orgName: string;
  userName: string;
  logoUrl?: string | null;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppLayout({
  pageTitle,
  actionSlot,
  currentPath,
  userRole,
  orgName,
  userName,
  logoUrl,
  onLogout,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-background-subtle)] text-foreground">
      <Sidebar
        userRole={userRole}
        orgName={orgName}
        userName={userName}
        logoUrl={logoUrl}
        currentPath={currentPath}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={pageTitle}
          actionSlot={actionSlot}
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

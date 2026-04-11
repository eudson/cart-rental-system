import type { ComponentType } from 'react';
import {
  Building2,
  CalendarDays,
  Car,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Tag,
  UserCog,
  Users,
} from 'lucide-react';
import { UserRole } from 'shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SidebarProps {
  userRole: UserRole;
  orgName: string;
  userName: string;
  logoUrl?: string | null;
  currentPath?: string;
  onLogout?: () => void;
}

interface SidebarLink {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const primaryLinks: SidebarLink[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: [UserRole.staff, UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Carts',
    href: '/carts',
    icon: Car,
    roles: [UserRole.staff, UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    roles: [UserRole.staff, UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Rentals',
    href: '/rentals',
    icon: CalendarDays,
    roles: [UserRole.staff, UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    roles: [UserRole.staff, UserRole.org_admin, UserRole.super_admin],
  },
];

const settingsLinks: SidebarLink[] = [
  {
    label: 'Organization',
    href: '/settings/organization',
    icon: Building2,
    roles: [UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Locations',
    href: '/settings/locations',
    icon: MapPin,
    roles: [UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Cart Types',
    href: '/settings/cart-types',
    icon: Tag,
    roles: [UserRole.org_admin, UserRole.super_admin],
  },
  {
    label: 'Users',
    href: '/settings/users',
    icon: UserCog,
    roles: [UserRole.org_admin, UserRole.super_admin],
  },
];

function canRender(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

function isActiveLink(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function formatRole(role: UserRole): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function Sidebar({
  userRole,
  orgName,
  userName,
  logoUrl,
  currentPath = '/dashboard',
  onLogout,
}: SidebarProps) {
  const visiblePrimaryLinks = primaryLinks.filter((link) => canRender(userRole, link.roles));
  const visibleSettingsLinks = settingsLinks.filter((link) => canRender(userRole, link.roles));

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-[var(--color-background-subtle)]">
      <div className="flex h-14 items-center px-4">
        {logoUrl ? (
          <img src={logoUrl} alt={`${orgName} logo`} className="h-7 max-w-[180px] object-contain" />
        ) : (
          <span className="text-sm font-semibold text-foreground">{orgName}</span>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          {visiblePrimaryLinks.map((link) => {
            const Icon = link.icon;
            const isActive = isActiveLink(currentPath, link.href);

            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-md border-l-2 px-3 text-sm transition-colors',
                  isActive
                    ? 'border-l-primary bg-background text-foreground'
                    : 'border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </a>
            );
          })}
        </div>

        {visibleSettingsLinks.length > 0 ? (
          <div className="space-y-3">
            <Separator />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Settings</p>
            <div className="space-y-1">
              {visibleSettingsLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActiveLink(currentPath, link.href);

                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-md border-l-2 px-3 text-sm transition-colors',
                      isActive
                        ? 'border-l-primary bg-background text-foreground'
                        : 'border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{orgName}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground">{userName}</p>
            <Badge variant="secondary" className="h-5 px-2 text-[10px] uppercase tracking-wide">
              {formatRole(userRole)}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-full justify-start px-2 text-muted-foreground hover:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

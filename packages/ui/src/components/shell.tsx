import * as React from 'react';
import { cn } from '../lib/cn';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

/**
 * Provider shell. A rail on desktop, a scrollable strip on mobile — no drawer
 * and no toggle, because a pharmacist at a counter should never need two taps
 * to reach the till.
 */
export function AppShell({
  product,
  signOut,
  nav,
  currentPath,
  user,
  children,
}: {
  signOut?: React.ReactNode;
  product: string;
  nav: NavItem[];
  currentPath: string;
  user: { name: string; subtitle?: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="on-navy bg-navy lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:sticky lg:top-0">
        <div className="flex items-center justify-between gap-3 px-5 py-3 lg:block lg:py-4">
          <div>
            <p className="font-display text-[0.9375rem] font-bold tracking-tight text-white">
              DOKTA
            </p>
            <p className="text-meta text-white/50">{product}</p>
          </div>
          <div className="text-right lg:hidden">
            <p className="text-sm font-medium text-white">{user.name}</p>
            {user.subtitle && <p className="text-meta text-white/50">{user.subtitle}</p>}
            {signOut}
          </div>
        </div>

        <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around gap-1 rounded-[1.35rem] border border-white/10 bg-navy/95 px-2 py-2 shadow-2xl backdrop-blur-xl lg:static lg:z-auto lg:flex-1 lg:flex-col lg:items-stretch lg:justify-start lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:px-3 lg:pb-3 lg:shadow-none">
          {nav.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.65rem] transition-colors lg:flex-none lg:flex-row lg:gap-2.5 lg:rounded-control lg:px-3 lg:py-2.5 lg:text-sm',
                  active ? 'bg-white/12 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" aria-hidden />
                <span className="max-w-full truncate whitespace-nowrap">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto rounded-pill bg-care px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          {user.subtitle && <p className="truncate text-meta text-white/50">{user.subtitle}</p>}
          {signOut}
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas pb-24 lg:pb-0">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline bg-white px-5 py-5 lg:px-8">
      <div>
        <h1 className="font-display text-[1.75rem] font-bold leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

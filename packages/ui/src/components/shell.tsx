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
  nav,
  currentPath,
  user,
  children,
}: {
  product: string;
  nav: NavItem[];
  currentPath: string;
  user: { name: string; subtitle?: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="on-navy bg-navy lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:sticky lg:top-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
          <div>
            <p className="font-display text-[0.9375rem] font-bold tracking-tight text-white">
              DOKTA
            </p>
            <p className="text-meta text-white/50">{product}</p>
          </div>
          <div className="text-right lg:hidden">
            <p className="text-sm font-medium text-white">{user.name}</p>
            {user.subtitle && <p className="text-meta text-white/50">{user.subtitle}</p>}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3">
          {nav.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-control px-3 py-2.5 text-sm transition-colors',
                  active ? 'bg-white/12 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
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
          <a href="/sign-out" className="mt-2 inline-block text-meta text-white/50 hover:text-white">
            Sign out
          </a>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas">{children}</main>
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

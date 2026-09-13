import { headers } from 'next/headers';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { AppShell } from '@dokta/ui';
import { getSession, homeFor } from '@dokta/auth';

export interface Area {
  product: string;
  nav: { href: string; label: string; icon: LucideIcon; badge?: number }[];
}

/**
 * One shell for all four areas. The nav differs; the chrome does not, so a
 * clinic clerk who also works a pharmacy till is not learning two interfaces.
 */
export async function RoleShell({ area, children }: { area: Area; children: React.ReactNode }) {
  const session = await getSession();
  const path = headers().get('x-pathname') ?? '/';

  return (
    <AppShell
      product={area.product}
      currentPath={path}
      nav={area.nav}
      user={{ name: session?.name ?? '', subtitle: session ? roleLabel(session.role) : undefined }}
    >
      <div id="main">{children}</div>
    </AppShell>
  );
}

function roleLabel(role: string) {
  return { patient: 'Patient', doctor: 'Doctor', pharmacy: 'Pharmacy', clinic: 'Clinic', admin: 'Administrator' }[role] ?? role;
}

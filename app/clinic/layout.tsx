import { Building2, ListOrdered, UserPlus } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { RoleShell } from '@/components/shell';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  await requireArea('/clinic');

  return (
    <RoleShell
      area={{
        product: 'Clinic',
        nav: [
          { href: '/clinic/queue', label: 'Queue', icon: ListOrdered },
          { href: '/clinic/registration', label: 'Registration', icon: UserPlus },
          { href: '/clinic/government', label: 'Government returns', icon: Building2 },
        ],
      }}
    >
      {children}
    </RoleShell>
  );
}

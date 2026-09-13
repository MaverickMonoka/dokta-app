import { CalendarDays, FileText, Pill } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { RoleShell } from '@/components/shell';

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  await requireArea('/patient');

  return (
    <RoleShell
      area={{
        product: 'My health',
        nav: [
          { href: '/patient/appointments', label: 'Appointments', icon: CalendarDays },
          { href: '/patient/medication', label: 'Medication', icon: Pill },
          { href: '/patient/records', label: 'Records', icon: FileText },
        ],
      }}
    >
      {children}
    </RoleShell>
  );
}

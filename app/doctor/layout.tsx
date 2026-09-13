import { CalendarDays, ClipboardList, Stethoscope, Users } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { RoleShell } from '@/components/shell';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  await requireArea('/doctor');

  return (
    <RoleShell
      area={{
        product: 'Doctor',
        nav: [
          { href: '/doctor/appointments', label: 'Appointments', icon: CalendarDays },
          { href: '/doctor/consultations', label: 'Consultations', icon: Stethoscope },
          { href: '/doctor/patients', label: 'Patients', icon: Users },
          { href: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
        ],
      }}
    >
      {children}
    </RoleShell>
  );
}

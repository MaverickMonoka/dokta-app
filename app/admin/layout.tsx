import { LayoutDashboard, Stethoscope } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { RoleShell } from '@/components/shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireArea('/admin');
  if (session.role !== 'admin') return null;
  return <RoleShell area={{ product: 'Admin', nav: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
  ] }}>{children}</RoleShell>;
}

import { BarChart3, Boxes, ScanLine, Truck } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { RoleShell } from '@/components/shell';

export default async function PharmacyLayout({ children }: { children: React.ReactNode }) {
  await requireArea('/pharmacy');

  return (
    <RoleShell
      area={{
        product: 'Pharmacy',
        nav: [
          { href: '/pharmacy/pos', label: 'Till', icon: ScanLine },
          { href: '/pharmacy/inventory', label: 'Stock', icon: Boxes },
          { href: '/pharmacy/suppliers', label: 'Suppliers', icon: Truck },
          { href: '/pharmacy/reports', label: 'Reports', icon: BarChart3 },
        ],
      }}
    >
      {children}
    </RoleShell>
  );
}

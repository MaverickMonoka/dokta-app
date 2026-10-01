import Link from 'next/link';
import { Building2, Pill, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { requireArea, supabaseAdmin } from '@dokta/auth';
import { Card, CardBody } from '@dokta/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin console' };

export default async function AdminHome() {
  const session = await requireArea('/admin');
  if (session.role !== 'admin') return null;
  const admin = supabaseAdmin();
  const [{ count: users }, { count: doctors }, { count: pharmacies }, { count: clinics }] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('doctors').select('id', { count: 'exact', head: true }),
    admin.from('pharmacies').select('id', { count: 'exact', head: true }),
    admin.from('clinics').select('id', { count: 'exact', head: true }),
  ]);
  return <div className="pb-10">
    <section className="relative overflow-hidden bg-navy px-5 py-9 text-white lg:px-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-care/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-care-light">Dokta administration</p><h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Admin Console</h1><p className="mt-2 max-w-xl text-sm text-white/60">Manage Dokta without using or knowing another user’s password.</p></div>
    </section>
    <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Users', users ?? 0, Users], ['Doctors', doctors ?? 0, Stethoscope], ['Pharmacies', pharmacies ?? 0, Pill], ['Clinics', clinics ?? 0, Building2],
      ].map(([label,value,Icon]: any)=><Card key={label}><CardBody className="pt-5"><Icon className="h-5 w-5 text-care"/><p className="mt-4 font-display text-2xl font-bold text-ink">{value}</p><p className="text-xs text-muted">{label}</p></CardBody></Card>)}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/doctors" className="rounded-card border border-hairline bg-white p-5 shadow-raise"><Stethoscope className="h-5 w-5 text-care"/><p className="mt-4 font-display font-semibold">Doctor onboarding</p><p className="mt-1 text-sm text-muted">Invite practitioner accounts and create pending profiles.</p></Link>
        <Link href="/account/password" className="rounded-card border border-hairline bg-white p-5 shadow-raise"><ShieldCheck className="h-5 w-5 text-care"/><p className="mt-4 font-display font-semibold">Administrator password</p><p className="mt-1 text-sm text-muted">Change your own administrator credential securely.</p></Link>
      </div>
      <div className="rounded-card border border-care/20 bg-care-soft p-5"><p className="text-sm font-semibold text-care-dark">Administrator access</p><p className="mt-1 text-sm text-muted">Your administrator identity can open authorised Dokta workspaces. Patient and staff passwords remain private and are never exposed to administrators.</p><div className="mt-4 flex flex-wrap gap-2">{[['Doctor','/doctor'],['Pharmacy','/pharmacy'],['Patient','/patient'],['Clinic','/clinic']].map(([name,href])=><Link key={name} href={href} className="rounded-lg border border-care/20 bg-white px-3 py-2 text-sm font-semibold text-care">{name} workspace</Link>)}</div></div>
    </div>
  </div>;
}

import Link from 'next/link';
import { Activity, ArrowRight, Building2, CalendarDays, FileText, LockKeyhole, Pill, ShieldCheck, Stethoscope, Users } from 'lucide-react';
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
  const firstName = session.name.split(' ')[0] || 'Administrator';
  return <div className="min-h-dvh bg-[#f3f7fb] pb-12">
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_15%,rgba(16,185,129,.32),transparent_25%),radial-gradient(circle_at_65%_-10%,rgba(56,189,248,.22),transparent_30%),linear-gradient(135deg,#041a2e,#082f4e_58%,#064e4b)] px-4 pb-16 pt-6 text-white sm:px-5 sm:pb-20 sm:pt-8 lg:px-8 lg:pb-24">
      <div className="pointer-events-none absolute right-[8%] top-6 hidden text-[11rem] font-black leading-none text-white/[0.035] lg:block">+</div>
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur"><ShieldCheck className="h-3.5 w-3.5"/> DOKTA ADMINISTRATION</div>
            <p className="text-sm font-medium text-white/55">Welcome back, {firstName}</p>
            <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl">Healthcare operations,<br/><span className="text-emerald-300">in one view.</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">Manage practitioners, pharmacies, clinics and platform access from the Dokta command centre.</p>
          </div>
          <div className="w-full min-w-0 lg:max-w-sm rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-cyan-400 font-display text-lg font-bold text-[#05263b]">{session.name.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{session.name}</p><p className="truncate text-xs text-white/50">{session.email}</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">Admin</span></div>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2"><Link href="/account/password" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"><LockKeyhole className="h-4 w-4"/> Security</Link><Link href="/admin/doctors" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-xs font-bold text-[#04283a] shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"><Stethoscope className="h-4 w-4"/> Onboard doctor</Link></div>
          </div>
        </div>
      </div>
    </section>
    <main className="relative mx-auto -mt-12 max-w-7xl space-y-5 px-4 sm:space-y-6 sm:px-5 lg:px-8">
      <section className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-4">{[
        ['Users', users ?? 0, Users, 'Platform accounts'], ['Doctors', doctors ?? 0, Stethoscope, 'Practitioners'], ['Pharmacies', pharmacies ?? 0, Pill, 'Dispensing network'], ['Clinics', clinics ?? 0, Building2, 'Care facilities'],
      ].map(([label,value,Icon,note]: any)=><Card key={label} className="overflow-hidden rounded-[1.4rem] border border-white bg-white shadow-xl shadow-slate-900/[0.06]"><CardBody className="pt-5"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon className="h-5 w-5"/></div><Activity className="h-4 w-4 text-slate-300"/></div><p className="mt-4 font-display text-3xl font-bold text-[#061d35]">{value}</p><p className="mt-1 text-sm font-semibold text-[#17344d]">{label}</p><p className="mt-0.5 text-xs text-slate-400">{note}</p></CardBody></Card>)}</section>
      <section className="rounded-[1.5rem] border border-white bg-white p-5 shadow-xl shadow-slate-900/[0.05]">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#061d35]">Quick actions</h2><p className="mt-1 text-xs text-slate-400">Common administration tasks</p></div></div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ['Onboard doctor','/admin/doctors',Stethoscope,'Invite practitioner'],
          ['Doctor workspace','/doctor',CalendarDays,'Clinical operations'],
          ['Pharmacy workspace','/pharmacy/reports',Pill,'Dispensing & stock'],
          ['Patient workspace','/patient',FileText,'Patient experience'],
        ].map(([name,href,Icon,note]:any)=><Link key={name} href={href} className="group rounded-2xl border border-slate-100 bg-[#f8fbfd] p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/50"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><Icon className="h-5 w-5"/></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500"/></div><p className="mt-4 text-sm font-semibold text-[#102e46]">{name}</p><p className="mt-1 text-xs text-slate-400">{note}</p></Link>)}</div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#082f4e,#064e4b)] p-6 text-white shadow-xl"><div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200"><ShieldCheck className="h-5 w-5"/></div><div><h2 className="font-display text-lg font-bold">Secure administrator access</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Your administrator identity opens authorised Dokta workspaces while patient and staff credentials remain private.</p></div></div></div>
        <Link href="/clinic/queue" className="group rounded-[1.5rem] border border-white bg-white p-6 shadow-xl shadow-slate-900/[0.05]"><Building2 className="h-5 w-5 text-emerald-600"/><p className="mt-4 font-display font-bold text-[#061d35]">Clinic workspace</p><p className="mt-1 text-sm text-slate-400">Queue and facility operations</p><ArrowRight className="mt-5 h-4 w-4 text-emerald-600 transition group-hover:translate-x-1"/></Link>
      </section>
    </main>
  </div>;
}

import Link from 'next/link';
import { CalendarDays, FileText, HeartPulse, Pill, Search, ShieldCheck } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, Card, CardBody, CardHeader, CardTitle, buttonVariants, shortDate, time } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'My health' };
export const dynamic = 'force-dynamic';

export default async function PatientHome() {
  const session = await requireArea('/patient');
  const supabase = db();
  const now = new Date().toISOString();
  const [{ data: appointments }, { data: prescriptions }, { data: documents }] = await Promise.all([
    supabase.from('appointments').select('id, scheduled_for, status, type, doctors ( speciality, users ( full_name ) )').gte('scheduled_for', now).not('status','in','(cancelled,no_show)').order('scheduled_for',{ascending:true}).limit(3),
    supabase.from('prescriptions').select('id, status, valid_until').order('created_at',{ascending:false}).limit(20),
    supabase.from('medical_documents').select('id').limit(100),
  ]);
  const next = appointments?.[0];
  const activeMedication = (prescriptions ?? []).filter((rx) => !['collected','cancelled','expired'].includes(rx.status) && new Date(rx.valid_until) >= new Date()).length;
  const firstName = session.name.split(' ')[0];

  return (
    <div className="pb-10">
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-navy to-[#075b91] px-5 pb-9 pt-7 text-white lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-care/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-care-light">Your health, in one place</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Hi, {firstName}</h1><p className="mt-2 text-sm text-white/60">Appointments, medication and records — private and easy to reach.</p></div>
            <Link href="/patient/appointments/book" className={buttonVariants({ className: 'shadow-lg shadow-black/10' })}><Search className="mr-2 h-4 w-4" /> Find a doctor</Link>
          </div>
          <div className="mt-7 grid grid-cols-3 gap-3">
            <div className="rounded-[1.25rem] bg-white/[0.10] p-4 ring-1 ring-white/15 backdrop-blur"><CalendarDays className="h-4 w-4 text-care-light"/><p className="mt-3 font-display text-2xl font-bold">{appointments?.length ?? 0}</p><p className="mt-1 text-xs text-white/50">Upcoming</p></div>
            <div className="rounded-card bg-white/[0.07] p-4 ring-1 ring-white/10"><Pill className="h-4 w-4 text-care-light"/><p className="mt-3 font-display text-2xl font-bold">{activeMedication}</p><p className="mt-1 text-xs text-white/50">Active scripts</p></div>
            <div className="rounded-card bg-white/[0.07] p-4 ring-1 ring-white/10"><FileText className="h-4 w-4 text-care-light"/><p className="mt-3 font-display text-2xl font-bold">{documents?.length ?? 0}</p><p className="mt-1 text-xs text-white/50">Documents</p></div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
        {next ? <Card className="overflow-hidden border-care/20"><CardHeader><div><p className="text-xs font-semibold uppercase tracking-wider text-care">Next appointment</p><CardTitle className="mt-1">{(next.doctors as never as {users:{full_name:string}}).users.full_name}</CardTitle></div><Badge status={next.status.toUpperCase()}/></CardHeader><CardBody><p className="text-sm text-muted">{shortDate(next.scheduled_for)} · {time(next.scheduled_for)} · {next.type.replace('_',' ')}</p><Link href="/patient/appointments" className="mt-4 inline-flex text-sm font-semibold text-care">View appointment →</Link></CardBody></Card> : <Card className="border-dashed"><CardBody className="py-7 text-center"><HeartPulse className="mx-auto h-7 w-7 text-care"/><p className="mt-3 font-display font-semibold">No upcoming consultations</p><p className="mt-1 text-sm text-muted">Book care when you need it.</p><Link href="/patient/appointments/book" className="mt-4 inline-flex text-sm font-semibold text-care">Find a doctor →</Link></CardBody></Card>}
        <section className="grid gap-4 sm:grid-cols-3">
          <Link href="/patient/appointments" className="rounded-[1.25rem] border border-white/70 bg-white/90 p-5 shadow-raise backdrop-blur"><CalendarDays className="h-5 w-5 text-care"/><p className="mt-4 font-display font-semibold">Appointments</p><p className="mt-1 text-sm text-muted">Bookings, payments and video consultations.</p></Link>
          <Link href="/patient/medication" className="rounded-[1.25rem] border border-white/70 bg-white/90 p-5 shadow-raise backdrop-blur"><Pill className="h-5 w-5 text-care"/><p className="mt-4 font-display font-semibold">Medication</p><p className="mt-1 text-sm text-muted">Your prescriptions and repeat status.</p></Link>
          <Link href="/patient/records" className="rounded-[1.25rem] border border-white/70 bg-white/90 p-5 shadow-raise backdrop-blur"><ShieldCheck className="h-5 w-5 text-care"/><p className="mt-4 font-display font-semibold">Health records</p><p className="mt-1 text-sm text-muted">Documents, readings and access history.</p></Link>
        </section>
        <div className="rounded-card bg-care-soft p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-care"/><div><p className="text-sm font-semibold text-care-dark">Your health information stays protected</p><p className="mt-1 text-xs leading-relaxed text-muted">Dokta records access to your medical information. You can review who opened your records from Health records.</p></div></div></div>
      </div>
    </div>
  );
}

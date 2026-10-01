import Link from 'next/link';
import { Activity, CalendarDays, Droplets, FileText, HeartPulse, Pill, Plus, ShieldCheck } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, shortDate, time } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'My health' };
export const dynamic = 'force-dynamic';

export default async function PatientHome() {
  const session = await requireArea('/patient');
  const supabase = db();
  const now = new Date().toISOString();
  const [{ data: appointments }, { data: prescriptions }, { data: documents }, { data: vitals }] = await Promise.all([
    supabase.from('appointments').select('id, scheduled_for, status, type, reason_for_visit, doctors ( speciality, users ( full_name ) )').gte('scheduled_for', now).not('status','in','(cancelled,no_show)').order('scheduled_for',{ascending:true}).limit(3),
    supabase.from('prescriptions').select('id, status, valid_until').order('created_at',{ascending:false}).limit(20),
    supabase.from('medical_documents').select('id').limit(100),
    supabase.from('vital_readings').select('id,metric,value,unit,recorded_at').order('recorded_at',{ascending:false}).limit(30),
  ]);
  const activeMedication=(prescriptions??[]).filter(rx=>!['collected','cancelled','expired'].includes(rx.status)&&new Date(rx.valid_until)>=new Date()).length;
  const latest=new Map<string,{value:string|number;unit:string}>();
  for(const v of vitals??[]) if(!latest.has(v.metric)) latest.set(v.metric,{value:v.value,unit:v.unit});
  const health=[
    {keys:['heart_rate','heart rate'],label:'Heart rate',icon:HeartPulse},
    {keys:['blood_pressure','blood pressure'],label:'Blood pressure',icon:Activity},
    {keys:['blood_glucose','blood glucose','glucose'],label:'Blood glucose',icon:Droplets},
  ].map(item=>({...item,reading:item.keys.map(k=>latest.get(k)).find(Boolean)})).filter(x=>x.reading);

  return <div className="min-h-dvh bg-[#061d35] text-white lg:bg-canvas lg:text-ink">
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(27,135,220,.42),transparent_36%),linear-gradient(155deg,#123f70_0%,#082b50_45%,#061d35_100%)] px-5 pb-7 pt-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between"><div><p className="font-display text-3xl font-bold tracking-tight">DOKTA</p><p className="mt-1 text-sm text-white/65">Hi, {session.name.split(' ')[0]}</p></div><div className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-lg font-bold shadow-xl backdrop-blur">{session.name.slice(0,1).toUpperCase()}</div></div>
        <div className="mt-8 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-300">Your care</p><h1 className="mt-1 font-display text-2xl font-bold">Appointments</h1></div><Link href="/patient/appointments/book" className="grid h-10 w-10 place-items-center rounded-full bg-sky-400 text-navy shadow-lg shadow-sky-950/30" aria-label="Book appointment"><Plus className="h-5 w-5"/></Link></div>
        <div className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          {(appointments??[]).length ? appointments!.map(a=>{const d=a.doctors as never as {speciality:string;users:{full_name:string}};return <Link key={a.id} href="/patient/appointments" className="min-w-[78%] snap-start rounded-[1.35rem] border border-white/15 bg-white/[0.12] p-4 shadow-xl backdrop-blur-xl sm:min-w-[300px]"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{d.users.full_name}</p><p className="text-xs text-white/55">{d.speciality}</p></div><Badge status={a.status.toUpperCase()}/></div><div className="mt-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/20 text-sky-300"><CalendarDays className="h-5 w-5"/></div><div><p className="font-semibold">{shortDate(a.scheduled_for)}</p><p className="text-sm text-white/65">{time(a.scheduled_for)}</p></div></div><p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/55">{a.reason_for_visit??a.type.replace('_',' ')}</p></Link>}) : <Link href="/patient/appointments/book" className="min-w-full rounded-[1.35rem] border border-dashed border-white/20 bg-white/[0.07] p-5 text-center"><CalendarDays className="mx-auto h-6 w-6 text-sky-300"/><p className="mt-3 font-semibold">No upcoming appointment</p><p className="mt-1 text-sm text-white/55">Tap to find a doctor and book care.</p></Link>}
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-7xl space-y-7 px-5 pb-8 lg:p-8">
      <section><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Health snapshot</h2><Link href="/patient/records" className="text-xs font-semibold text-sky-300 lg:text-care">View records</Link></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {health.length?health.map(({label,icon:Icon,reading})=><div key={label} className="min-h-32 rounded-[1.35rem] border border-sky-300/15 bg-gradient-to-br from-[#164e80] to-[#0b6ab0] p-4 shadow-xl"><div className="flex items-center justify-between"><p className="text-sm text-white/75">{label}</p><Icon className="h-4 w-4 text-cyan-300"/></div><p className="mt-4 font-display text-2xl font-bold">{reading!.value}<span className="ml-1 text-xs font-normal text-white/60">{reading!.unit}</span></p><div className="mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-cyan-300/70"/></div></div>):<><div className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4"><HeartPulse className="h-5 w-5 text-sky-300"/><p className="mt-4 font-semibold">Health readings</p><p className="mt-1 text-xs text-white/50">No readings recorded yet.</p></div><div className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4"><ShieldCheck className="h-5 w-5 text-sky-300"/><p className="mt-4 font-semibold">Private records</p><p className="mt-1 text-xs text-white/50">{documents?.length??0} documents stored.</p></div></>}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3"><Link href="/patient/medication" className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4 lg:border-hairline lg:bg-white"><Pill className="h-5 w-5 text-sky-300 lg:text-care"/><p className="mt-4 font-display text-xl font-bold">{activeMedication}</p><p className="text-xs text-white/50 lg:text-muted">Active prescriptions</p></Link><Link href="/patient/records" className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4 lg:border-hairline lg:bg-white"><FileText className="h-5 w-5 text-sky-300 lg:text-care"/><p className="mt-4 font-display text-xl font-bold">{documents?.length??0}</p><p className="text-xs text-white/50 lg:text-muted">Health documents</p></Link></section>
      <Link href="/patient/appointments/book" className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold shadow-xl backdrop-blur lg:bg-care lg:text-white"><Plus className="h-4 w-4"/> New appointment</Link>
    </div>
  </div>;
}

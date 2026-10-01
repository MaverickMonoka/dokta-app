import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, ClipboardList, Stethoscope, Users, WalletCards } from 'lucide-react';
import { audit, requireArea } from '@dokta/auth';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  buttonVariants,
  money,
  time,
} from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Doctor dashboard' };
export const dynamic = 'force-dynamic';

function johannesburgDay(offsetDays = 0) {
  const shifted = new Date(Date.now() + offsetDays * 86_400_000);
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
  return `${day}T00:00:00+02:00`;
}

export default async function DoctorDashboard() {
  const session = await requireArea('/doctor');
  const supabase = db();
  const todayStart = johannesburgDay();
  const tomorrowStart = johannesburgDay(1);
  const weekEnd = johannesburgDay(8);

  const [{ data: doctor }, { data: upcoming }, { data: consultations }] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, speciality, verification, rating, rating_count, consult_fee, offers_video, offers_in_person, clinics ( name )')
      .eq('user_id', session.id)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('id, reference, scheduled_for, status, payment_status, fee, type, reason_for_visit, patients ( id, users ( full_name ) )')
      .gte('scheduled_for', todayStart)
      .lt('scheduled_for', weekEnd)
      .in('status', ['requested', 'confirmed', 'in_progress'])
      .order('scheduled_for', { ascending: true }),
    supabase
      .from('consultations')
      .select('id, diagnosis, signed_at, appointments!inner ( doctor_id )')
      .is('signed_at', null)
      .limit(100),
  ]);

  const appointments = upcoming ?? [];
  const today = appointments.filter(
    (appointment) => appointment.scheduled_for >= todayStart && appointment.scheduled_for < tomorrowStart,
  );
  const paidToday = today.filter((appointment) => appointment.payment_status === 'succeeded');
  const grossToday = paidToday.reduce((total, appointment) => total + Number(appointment.fee), 0);
  const unsigned = (consultations ?? []).filter((consultation) => consultation.diagnosis).length;
  const next = today.find((appointment) => appointment.status !== 'completed') ?? appointments[0];

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'DoctorDashboard',
    lawfulBasis: 'provision_of_healthcare',
    metadata: { today: today.length, upcoming: appointments.length, unsigned },
  });

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(56,189,248,.30),transparent_34%),linear-gradient(145deg,#123f70,#082b50_55%,#061d35)] px-5 pb-10 pt-7 text-white lg:px-8 lg:pb-10 lg:pt-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-care/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-care-light">Clinical command centre</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Dr {session.name.split(' ').at(-1)}</h1>
              <p className="mt-2 max-w-xl text-sm text-white/60">{doctor?.speciality ?? 'Doctor'} · {today.length} patient{today.length === 1 ? '' : 's'} today</p>
            </div>
            {next ? <Link href={`/doctor/consultations/${next.id}`} className={buttonVariants({ className: 'shadow-lg shadow-black/10' })}>Open next patient <ArrowRight className="ml-2 h-4 w-4" /></Link> : null}
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Patients today', value: today.length, note: `${paidToday.length} paid`, icon: Users },
              { label: 'Next 7 days', value: appointments.length, note: 'Active bookings', icon: CalendarDays },
              { label: 'Notes to sign', value: unsigned, note: unsigned ? 'Action required' : 'All up to date', icon: ClipboardList },
              { label: 'Gross today', value: money(grossToday), note: 'Paid appointments', icon: WalletCards },
            ].map(({ label, value, note, icon: Icon }) => (
              <div key={label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] shadow-xl p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between"><p className="text-xs font-medium text-white/55">{label}</p><Icon className="h-4 w-4 text-care-light" /></div>
                <p className="money mt-3 font-display text-2xl font-bold">{value}</p>
                <p className="mt-1 text-xs text-white/45">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
        {!doctor ? (
          <Card className="border-alert/30 bg-alert-soft">
            <CardBody className="flex gap-3 pt-5">
              <AlertCircle className="h-5 w-5 shrink-0 text-alert" aria-hidden />
              <div>
                <p className="font-medium text-ink">Doctor profile not linked</p>
                <p className="mt-1 text-sm text-muted">An administrator must link your verified practitioner record before patients can book you.</p>
              </div>
            </CardBody>
          </Card>
        ) : doctor.verification !== 'verified' ? (
          <Card className="border-warn/30 bg-warn-soft">
            <CardBody className="flex gap-3 pt-5">
              <Clock3 className="h-5 w-5 shrink-0 text-warn" aria-hidden />
              <div>
                <p className="font-medium text-ink">HPCSA verification pending</p>
                <p className="mt-1 text-sm text-muted">You can review your workspace, but prescribing and public bookings remain restricted until Dokta verifies your practitioner profile.</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="border-care/30 bg-care-soft">
            <CardBody className="flex items-center gap-3 pt-5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-care" aria-hidden />
              <p className="text-sm font-medium text-care-dark">Verified practitioner · {doctor.speciality}</p>
            </CardBody>
          </Card>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <Link href="/doctor/appointments" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <CalendarDays className="h-5 w-5 text-care" /><p className="mt-4 font-display font-semibold text-ink">Today’s schedule</p><p className="mt-1 text-sm text-muted">Review the queue and open consultations.</p><ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/doctor/patients" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <Users className="h-5 w-5 text-care" /><p className="mt-4 font-display font-semibold text-ink">Patient care</p><p className="mt-1 text-sm text-muted">Access patients within your care relationship.</p><ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/doctor/prescriptions" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <Stethoscope className="h-5 w-5 text-care" /><p className="mt-4 font-display font-semibold text-ink">Prescriptions</p><p className="mt-1 text-sm text-muted">Track issued and active prescriptions.</p><ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Today’s patient list</CardTitle>
                <p className="mt-1 text-meta text-muted">Open a patient to begin or continue their consultation.</p>
              </div>
              <Link href="/doctor/appointments" className="text-sm font-medium text-care hover:underline">View schedule</Link>
            </CardHeader>
            <CardBody>
              {today.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No appointments today" body="Your confirmed and requested bookings will appear here." />
              ) : (
                <ul className="divide-y divide-hairline">
                  {today.map((appointment) => {
                    const patient = appointment.patients as never as { id: string; users: { full_name: string } };
                    return (
                      <li key={appointment.id}>
                        <Link href={`/doctor/consultations/${appointment.id}`} className="flex items-center gap-4 py-3.5 hover:bg-canvas">
                          <span className="money w-14 shrink-0 text-sm font-semibold text-ink">{time(appointment.scheduled_for)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{patient.users.full_name}</span>
                            <span className="block truncate text-meta text-muted">{appointment.reason_for_visit ?? appointment.type.replace('_', ' ')}</span>
                          </span>
                          <Badge status={appointment.status.toUpperCase()} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="space-y-5">
            <Card tone="navy">
              <CardHeader><CardTitle>Practice snapshot</CardTitle></CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-white/60">Speciality</span><span>{doctor?.speciality ?? 'Not linked'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-white/60">Clinic</span><span className="text-right">{(doctor?.clinics as never as { name: string } | null)?.name ?? 'Independent'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-white/60">Consultation fee</span><span className="money">{money(Number(doctor?.consult_fee ?? 0))}</span></div>
                <div className="flex justify-between gap-3"><span className="text-white/60">Rating</span><span>{Number(doctor?.rating ?? 0).toFixed(1)} · {doctor?.rating_count ?? 0} reviews</span></div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Clinical shortcuts</CardTitle></CardHeader>
              <CardBody className="grid gap-2">
                <Link href="/doctor/consultations" className="flex items-center gap-3 rounded-lg border border-hairline p-3 text-sm font-medium text-ink hover:border-care"><Stethoscope className="h-4 w-4 text-care" /> Consultation notes</Link>
                <Link href="/doctor/patients" className="flex items-center gap-3 rounded-lg border border-hairline p-3 text-sm font-medium text-ink hover:border-care"><Users className="h-4 w-4 text-care" /> Patient directory</Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

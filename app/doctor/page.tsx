import Link from 'next/link';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Stethoscope, Users } from 'lucide-react';
import { audit, requireArea } from '@dokta/auth';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Stat,
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
      <PageHeader
        title={`Welcome, Dr ${session.name.split(' ').at(-1)}`}
        description="Your clinical workspace: today's queue, patient care and records in one place."
        actions={
          next ? (
            <Link href={`/doctor/consultations/${next.id}`} className={buttonVariants()}>
              Open next patient
            </Link>
          ) : null
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Patients today" value={today.length} hint={`${paidToday.length} paid`} />
          <Stat label="Next 7 days" value={appointments.length} hint="Active bookings" />
          <Stat label="Notes to sign" value={unsigned} hint={unsigned ? 'Action required' : 'All up to date'} />
          <Stat label="Today’s gross fees" value={money(grossToday)} hint="Paid appointments" />
        </div>

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

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { Badge, EmptyState, PageHeader, Stat, buttonVariants, money, time } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Appointments' };
export const dynamic = 'force-dynamic';

export default async function DoctorAppointments() {
  const session = await requireArea('/doctor/appointments');
  const supabase = db();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: today } = await supabase
    .from('appointments')
    .select(`
      id, reference, scheduled_for, status, payment_status, fee, reason_for_visit, symptoms,
      patients ( id, allergies, date_of_birth, users ( full_name ) )
    `)
    .gte('scheduled_for', start.toISOString())
    .lt('scheduled_for', end.toISOString())
    .order('scheduled_for', { ascending: true });

  const rows = today ?? [];

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'Appointment',
    lawfulBasis: 'provision_of_healthcare',
    metadata: { count: rows.length },
  });

  const paid = rows.filter((a) => a.payment_status === 'succeeded');
  const expected = paid.reduce((sum, a) => sum + Number(a.fee), 0);

  return (
    <>
      <PageHeader
        title="Today"
        description={new Intl.DateTimeFormat('en-ZA', { dateStyle: 'full' }).format(new Date())}
        actions={
          rows[0] ? (
            <Link href={`/doctor/consultations/${rows[0].id}`} className={buttonVariants()}>
              Start next
            </Link>
          ) : null
        }
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Patients today" value={rows.length} />
          <Stat label="Paid" value={paid.length} hint={`${rows.length - paid.length} awaiting payment`} />
          <Stat label="Expected today" value={money(expected * 0.88)} hint="After 12% platform fee" />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No patients booked today"
            body="Open more consulting hours and patients will be able to book them."
          />
        ) : (
          <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
            {rows.map((a) => {
              const patient = a.patients as never as {
                id: string;
                allergies: string[];
                users: { full_name: string };
              };
              const allergies = patient.allergies ?? [];

              return (
                <li key={a.id}>
                  <Link
                    href={`/doctor/consultations/${a.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas"
                  >
                    <span className="money w-14 shrink-0 text-sm font-semibold text-ink">
                      {time(a.scheduled_for)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {patient.users.full_name}
                      </span>
                      <span className="block truncate text-meta text-muted">
                        {a.reason_for_visit ?? 'No reason given'}
                      </span>
                    </span>
                    {allergies.length > 0 && (
                      <Badge tone="alert" className="shrink-0">
                        Allergy: {allergies[0]}
                      </Badge>
                    )}
                    <Badge status={a.status.toUpperCase()} className="shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

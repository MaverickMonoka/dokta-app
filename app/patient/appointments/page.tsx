import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, Card, CardBody, EmptyState, PageHeader, buttonVariants, money, shortDate, time } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Appointments' };
export const dynamic = 'force-dynamic';

export default async function PatientAppointments() {
  await requireArea('/patient/appointments');

  // RLS limits this to the caller's own appointments — no patient_id filter needed.
  const { data: appointments } = await db()
    .from('appointments')
    .select(`
      id, reference, scheduled_for, type, status, payment_status, fee, reason_for_visit, room_id,
      doctors ( speciality, users ( full_name ) )
    `)
    .order('scheduled_for', { ascending: false })
    .limit(30);

  const rows = appointments ?? [];
  const upcoming = rows.filter(
    (a) => new Date(a.scheduled_for) > new Date() && !['cancelled', 'no_show'].includes(a.status),
  );
  const past = rows.filter((a) => !upcoming.includes(a));

  return (
    <>
      <PageHeader
        title="Appointments"
        actions={
          <Link href="/patient/appointments/book" className={buttonVariants()}>
            Book a consultation
          </Link>
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No appointments yet"
            body="Find a doctor by speciality, price and language, and book a time that suits you."
            action={{ label: 'Book a consultation', href: '/patient/appointments/book' }}
          />
        ) : (
          <>
            <section>
              <h2 className="mb-3 font-display text-title text-ink">Coming up</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted">Nothing booked.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map((a) => {
                    const doctor = a.doctors as never as { speciality: string; users: { full_name: string } };
                    return (
                      <li key={a.id}>
                        <Card>
                          <CardBody className="pt-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">
                                  {doctor.users.full_name}
                                </p>
                                <p className="truncate text-meta text-muted">{doctor.speciality}</p>
                              </div>
                              <Badge status={a.status.toUpperCase()} />
                            </div>

                            <p className="mt-3 text-sm text-ink">
                              {shortDate(a.scheduled_for)} at {time(a.scheduled_for)}
                            </p>

                            {a.payment_status !== 'succeeded' ? (
                              <Link
                                href={`/patient/appointments/${a.id}/pay`}
                                className={buttonVariants({ size: 'sm', className: 'mt-4' })}
                              >
                                Pay {money(Number(a.fee))} to confirm
                              </Link>
                            ) : a.type === 'video' && a.room_id ? (
                              <a
                                href={a.room_id}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ size: 'sm', className: 'mt-4' })}
                              >
                                Join consultation
                              </a>
                            ) : null}
                          </CardBody>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-title text-ink">Past</h2>
                <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
                  {past.map((a) => {
                    const doctor = a.doctors as never as { speciality: string; users: { full_name: string } };
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">
                            {doctor.users.full_name}
                          </span>
                          <span className="block text-meta text-muted">
                            {shortDate(a.scheduled_for)}
                          </span>
                        </span>
                        <Badge status={a.status.toUpperCase()} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

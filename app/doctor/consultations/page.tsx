import Link from 'next/link';
import { Stethoscope } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, DataTable, EmptyState, PageHeader, Stat, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Consultations' };
export const dynamic = 'force-dynamic';

export default async function ConsultationsList() {
  await requireArea('/doctor/consultations');

  const { data: consultations } = await db()
    .from('consultations')
    .select(`
      id, diagnosis, notes, signed_at, created_at,
      appointments ( id, scheduled_for, status, patients ( users ( full_name ) ) )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = consultations ?? [];
  const unsigned = rows.filter((c) => !c.signed_at && c.diagnosis);

  return (
    <>
      <PageHeader
        title="Consultations"
        description="A signed note is the legal record and cannot be edited afterwards. Corrections are added as an addendum."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total" value={rows.length} />
          <Stat
            label="Awaiting your signature"
            value={unsigned.length}
            hint={unsigned.length ? 'Not visible to the patient until signed' : 'All signed'}
          />
          <Stat label="Signed" value={rows.filter((c) => c.signed_at).length} />
        </div>

        <DataTable
          rows={rows}
          rowKey={(c) => c.id}
          empty={
            <EmptyState
              icon={Stethoscope}
              title="No consultations yet"
              body="Notes appear here once you start seeing patients."
            />
          }
          columns={[
            {
              key: 'patient',
              header: 'Patient',
              render: (c) => {
                const appointment = c.appointments as never as {
                  id: string;
                  patients: { users: { full_name: string } };
                };
                return (
                  <Link href={`/doctor/consultations/${appointment.id}`} className="font-medium text-ink hover:text-care">
                    {appointment.patients.users.full_name}
                  </Link>
                );
              },
            },
            {
              key: 'diagnosis',
              header: 'Diagnosis',
              render: (c) => c.diagnosis ?? <span className="text-muted">Not recorded</span>,
            },
            { key: 'when', header: 'Date', render: (c) => shortDate(c.created_at) },
            {
              key: 'signed',
              header: 'Status',
              render: (c) =>
                c.signed_at ? <Badge tone="care">Signed</Badge> : <Badge tone="warn">Draft</Badge>,
            },
          ]}
        />
      </div>
    </>
  );
}

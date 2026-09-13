import Link from 'next/link';
import { Users } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { DataTable, EmptyState, PageHeader, age, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Patients' };
export const dynamic = 'force-dynamic';

/**
 * A doctor sees the patients they treat, not a directory. That restriction is
 * enforced by the treats_patient() predicate in RLS, not by this query — the
 * query asks for everything and the database returns only what is permitted.
 */
export default async function DoctorPatients() {
  const session = await requireArea('/doctor/patients');

  const { data: patients } = await db()
    .from('patients')
    .select('id, date_of_birth, gender, allergies, city, province, created_at, users ( full_name, phone )')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = patients ?? [];

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'Patient',
    lawfulBasis: 'provision_of_healthcare',
    metadata: { count: rows.length },
  });

  return (
    <>
      <PageHeader
        title="Your patients"
        description="Everyone you have treated, are treating, or are booked to treat."
      />

      <div className="p-5 lg:p-8">
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          empty={
            <EmptyState
              icon={Users}
              title="No patients yet"
              body="A patient appears here once they book with you or you write them a prescription."
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Patient',
              render: (p) => {
                const user = p.users as never as { full_name: string; phone: string | null };
                return (
                  <span>
                    <span className="block font-medium text-ink">{user.full_name}</span>
                    <span className="money block text-meta text-muted">{user.phone ?? '—'}</span>
                  </span>
                );
              },
            },
            { key: 'age', header: 'Age', numeric: true, render: (p) => age(p.date_of_birth) ?? '—' },
            { key: 'gender', header: 'Sex', render: (p) => p.gender },
            {
              key: 'allergies',
              header: 'Allergies',
              render: (p) => {
                const allergies = (p.allergies as string[]) ?? [];
                return allergies.length ? (
                  <span className="text-alert">{allergies.join(', ')}</span>
                ) : (
                  <span className="text-muted">None recorded</span>
                );
              },
            },
            {
              key: 'location',
              header: 'Location',
              render: (p) => [p.city, p.province].filter(Boolean).join(', ') || '—',
            },
          ]}
        />
      </div>
    </>
  );
}

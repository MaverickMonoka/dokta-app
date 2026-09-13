import { ClipboardList } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, DataTable, EmptyState, PageHeader, Stat, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Prescriptions' };
export const dynamic = 'force-dynamic';

export default async function DoctorPrescriptions() {
  await requireArea('/doctor/prescriptions');

  const { data: prescriptions } = await db()
    .from('prescriptions')
    .select(`
      id, reference, status, valid_until, repeats, repeats_used, created_at,
      prescription_items ( medicine_name, strength ),
      patients ( users ( full_name ) ),
      pharmacies ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = prescriptions ?? [];
  const active = rows.filter((r) => !['collected', 'cancelled', 'expired'].includes(r.status));

  return (
    <>
      <PageHeader
        title="Prescriptions you have written"
        description="Schedule 5 and 6 scripts are capped at 30 days with no repeats — the database enforces that, not the form."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Written" value={rows.length} />
          <Stat label="Still active" value={active.length} />
          <Stat
            label="Awaiting a pharmacy"
            value={rows.filter((r) => r.status === 'issued').length}
          />
        </div>

        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No prescriptions yet"
              body="Scripts you issue during a consultation appear here."
            />
          }
          columns={[
            {
              key: 'patient',
              header: 'Patient',
              render: (r) => (r.patients as never as { users: { full_name: string } }).users.full_name,
            },
            {
              key: 'items',
              header: 'Medicines',
              render: (r) => {
                const items = r.prescription_items as { medicine_name: string; strength: string | null }[];
                const first = items?.[0];
                return (
                  <span>
                    <span className="block text-ink">
                      {first ? `${first.medicine_name} ${first.strength ?? ''}`.trim() : '—'}
                    </span>
                    {items?.length > 1 && (
                      <span className="block text-meta text-muted">+{items.length - 1} more</span>
                    )}
                  </span>
                );
              },
            },
            { key: 'ref', header: 'Reference', render: (r) => <span className="money">{r.reference}</span> },
            {
              key: 'pharmacy',
              header: 'Pharmacy',
              render: (r) => (r.pharmacies as never as { name: string } | null)?.name ?? 'Not sent',
            },
            { key: 'valid', header: 'Valid until', render: (r) => shortDate(r.valid_until) },
            { key: 'status', header: 'Status', render: (r) => <Badge status={r.status.toUpperCase()} /> },
          ]}
        />
      </div>
    </>
  );
}

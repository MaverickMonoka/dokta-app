import { Pill } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { Badge, Card, CardBody, EmptyState, PageHeader, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Medication' };
export const dynamic = 'force-dynamic';

export default async function PatientMedication() {
  const session = await requireArea('/patient/medication');

  const { data: prescriptions } = await db()
    .from('prescriptions')
    .select(`
      id, reference, status, valid_until, repeats, repeats_used, notes,
      prescription_items ( id, medicine_name, strength, dosage, frequency, quantity, instructions ),
      doctors ( users ( full_name ) ),
      pharmacies ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'Prescription',
    lawfulBasis: 'data_subject_access',
  });

  const rows = prescriptions ?? [];

  return (
    <>
      <PageHeader
        title="Medication"
        description="Every prescription written for you. Send one to a pharmacy to have it filled."
      />

      <div className="p-5 lg:p-8">
        {rows.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No prescriptions yet"
            body="A doctor can issue one during a consultation. It appears here straight away."
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {rows.map((rx) => {
              const doctor = rx.doctors as never as { users: { full_name: string } };
              const pharmacy = rx.pharmacies as never as { name: string } | null;
              const expired = new Date(rx.valid_until) < new Date();

              return (
                <li key={rx.id}>
                  <Card>
                    <CardBody className="pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{doctor.users.full_name}</p>
                          <p className="money text-meta text-muted">{rx.reference}</p>
                        </div>
                        <Badge status={rx.status.toUpperCase()} />
                      </div>

                      <ul className="mt-4 space-y-2.5">
                        {(rx.prescription_items ?? []).map((item) => (
                          <li key={item.id}>
                            <p className="text-sm font-medium text-ink">
                              {item.medicine_name} {item.strength}
                            </p>
                            <p className="text-meta text-muted">
                              {item.dosage}, {item.frequency}
                            </p>
                            {item.instructions && (
                              <p className="mt-0.5 text-meta text-ink/70">{item.instructions}</p>
                            )}
                          </li>
                        ))}
                      </ul>

                      <p className={`mt-4 text-meta ${expired ? 'text-alert' : 'text-muted'}`}>
                        {expired ? 'Expired ' : 'Valid until '}
                        {shortDate(rx.valid_until)}
                        {rx.repeats > 0 && ` · ${rx.repeats - rx.repeats_used} repeats left`}
                        {pharmacy && ` · at ${pharmacy.name}`}
                      </p>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

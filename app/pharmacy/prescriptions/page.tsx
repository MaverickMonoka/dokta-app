import { ClipboardCheck, Pill } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { Badge, Card, CardBody, EmptyState, PageHeader, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';
import { DispenseButton } from '@/components/dispense-button';

export const metadata = { title: 'Prescription queue' };
export const dynamic = 'force-dynamic';

export default async function PharmacyPrescriptions() {
  const session = await requireArea('/pharmacy/prescriptions');
  const supabase = db();
  const { data: pharmacies } = await supabase.from('pharmacies').select('id, name, verification').limit(1);
  const pharmacy = pharmacies?.[0];

  if (!pharmacy) return <EmptyState icon={Pill} title="No pharmacy linked" body="Link this account to a pharmacy before opening prescriptions." />;

  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select(`id, reference, status, valid_until, repeats, repeats_used, created_at,
      prescription_items ( id, medicine_name, strength, dosage, frequency, quantity, instructions ),
      patients ( users ( full_name ) ),
      doctors ( users ( full_name ) )`)
    .eq('pharmacy_id', pharmacy.id)
    .order('created_at', { ascending: false })
    .limit(100);

  await audit({ actorId: session.id, action: 'read', entity: 'Prescription', lawfulBasis: 'provision_of_healthcare', metadata: { pharmacyId: pharmacy.id, count: prescriptions?.length ?? 0 } });

  const { data: staff } = await supabase.from('pharmacy_staff').select('can_dispense').eq('pharmacy_id', pharmacy.id).eq('user_id', session.id).maybeSingle();
  const canDispense = pharmacy.verification === 'verified' && staff?.can_dispense === true;
  const rows = prescriptions ?? [];
  return <><PageHeader title="Prescription queue" description={pharmacy.name} /><div className="space-y-4 p-5 lg:p-8">
    {rows.length === 0 ? <EmptyState icon={ClipboardCheck} title="Queue clear" body="Prescriptions sent to this pharmacy appear here." /> :
      <div className="grid gap-4 xl:grid-cols-2">{rows.map(rx => {
        const patient = rx.patients as never as { users: { full_name: string } };
        const doctor = rx.doctors as never as { users: { full_name: string } };
        return <Card key={rx.id}><CardBody className="pt-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{patient.users.full_name}</p><p className="money text-xs text-muted">{rx.reference} · {doctor.users.full_name}</p></div><Badge status={rx.status.toUpperCase()} /></div>
          <ul className="mt-4 space-y-3">{(rx.prescription_items ?? []).map(item => <li key={item.id} className="rounded-control bg-canvas p-3"><p className="font-medium text-ink">{item.medicine_name} {item.strength ?? ''}</p><p className="mt-1 text-xs text-muted">{item.dosage} · {item.frequency} · Qty {item.quantity}</p>{item.instructions && <p className="mt-1 text-xs text-ink/70">{item.instructions}</p>}</li>)}</ul>
          <div className="mt-4 flex justify-between text-xs text-muted"><span>Valid to {shortDate(rx.valid_until)}</span><span>{Math.max(0, rx.repeats-rx.repeats_used)} repeats left</span></div><DispenseButton prescriptionId={rx.id} pharmacyId={pharmacy.id} disabled={!canDispense || !['sent_to_pharmacy','dispensed'].includes(rx.status)} />{!canDispense && <p className="mt-2 text-xs text-amber-700">Dispensing activates after pharmacy verification and dispensing permission.</p>}
        </CardBody></Card>
      })}</div>}
  </div></>;
}

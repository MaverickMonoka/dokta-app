import { requireArea } from '@dokta/auth';
import { EmptyState } from '@dokta/ui';
import { ScanLine } from 'lucide-react';
import { db } from '@/lib/db';
import { PosTerminal } from '@/components/pos-terminal';

export const metadata = { title: 'Till' };
export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await requireArea('/pharmacy/pos');
  const supabase = db();

  // RLS returns only pharmacies this person owns or works at.
  const { data: pharmacies } = await supabase.from('pharmacies').select('id, name').limit(1);
  const pharmacy = pharmacies?.[0];

  if (!pharmacy) {
    return (
      <EmptyState
        icon={ScanLine}
        title="This account is not linked to a pharmacy"
        body="Ask the pharmacy owner to add you as staff, then sign in again."
      />
    );
  }

  const { data: quickKeys } = await supabase
    .from('inventory_items')
    .select('id, selling_price, stock_on_hand, medicines ( id, name, strength, schedule )')
    .eq('is_active', true)
    .gt('stock_on_hand', 0)
    .limit(12);

  return (
    <PosTerminal
      pharmacyId={pharmacy.id}
      cashierName={session.name}
      quickKeys={(quickKeys ?? []).map((item) => {
        const medicine = item.medicines as never as {
          id: string; name: string; strength: string | null; schedule: string;
        };
        return {
          inventoryId: item.id,
          medicineId: medicine.id,
          name: medicine.name,
          strength: medicine.strength,
          unitPrice: Number(item.selling_price),
          stockOnHand: item.stock_on_hand,
          requiresPharmacist: medicine.schedule !== 'S0' && medicine.schedule !== 'S1',
        };
      })}
    />
  );
}

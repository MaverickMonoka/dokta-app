import { Boxes } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, DataTable, EmptyState, PageHeader, Stat, money } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Stock' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  await requireArea('/pharmacy/inventory');
  const supabase = db();

  const [{ data: items }, { data: batches }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id, selling_price, cost_price, stock_on_hand, reorder_level, is_active, medicines ( name, strength, schedule )'),
    supabase
      .from('stock_batches')
      .select('id, inventory_id, batch_number, quantity, expiry_date')
      .lte('expiry_date', new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true }),
  ]);

  const rows = items ?? [];
  const stockValue = rows.reduce((sum, i) => sum + Number(i.cost_price ?? 0) * i.stock_on_hand, 0);
  const retailValue = rows.reduce((sum, i) => sum + Number(i.selling_price) * i.stock_on_hand, 0);
  const low = rows.filter((i) => i.stock_on_hand <= i.reorder_level);
  const expiring = batches ?? [];

  const firstExpiry = new Map<string, string>();
  for (const batch of expiring) {
    if (!firstExpiry.has(batch.inventory_id)) firstExpiry.set(batch.inventory_id, batch.expiry_date);
  }

  return (
    <>
      <PageHeader
        title="Stock"
        description="Stock leaves first-expiry-first. Expired batches are skipped entirely — they cannot be sold or dispensed."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Lines stocked" value={rows.length} />
          <Stat label="At cost" value={money(stockValue)} />
          <Stat label="At retail" value={money(retailValue)} />
          <Stat
            label="Below reorder level"
            value={low.length}
            hint={low.length ? 'Order these' : 'All above level'}
          />
        </div>

        <DataTable
          rows={rows}
          rowKey={(i) => i.id}
          empty={
            <EmptyState
              icon={Boxes}
              title="No stock loaded"
              body="Add the lines you sell so they can be scanned at the till and dispensed against scripts."
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Medicine',
              render: (i) => {
                const m = i.medicines as never as { name: string; strength: string | null };
                return (
                  <span>
                    <span className="block font-medium text-ink">{m.name}</span>
                    <span className="block text-meta text-muted">{m.strength ?? '—'}</span>
                  </span>
                );
              },
            },
            {
              key: 'schedule',
              header: 'Schedule',
              render: (i) => {
                const m = i.medicines as never as { schedule: string };
                return <Badge tone={m.schedule === 'S0' ? 'neutral' : 'warn'}>{m.schedule}</Badge>;
              },
            },
            {
              key: 'stock',
              header: 'On hand',
              numeric: true,
              render: (i) => (
                <span className={i.stock_on_hand <= i.reorder_level ? 'font-semibold text-alert' : ''}>
                  {i.stock_on_hand}
                </span>
              ),
            },
            { key: 'reorder', header: 'Reorder at', numeric: true, render: (i) => i.reorder_level },
            { key: 'cost', header: 'Cost', numeric: true, render: (i) => money(Number(i.cost_price ?? 0)) },
            { key: 'price', header: 'Price', numeric: true, render: (i) => money(Number(i.selling_price)) },
            {
              key: 'expiry',
              header: 'First expiry',
              render: (i) => {
                const date = firstExpiry.get(i.id);
                if (!date) return <span className="text-muted">Beyond 6 months</span>;
                const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
                return (
                  <span className={days <= 30 ? 'text-alert' : days <= 90 ? 'text-warn' : ''}>
                    {days <= 0 ? 'Expired' : `${days} days`}
                  </span>
                );
              },
            },
          ]}
        />
      </div>
    </>
  );
}

import { Truck } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { DataTable, EmptyState, PageHeader, Stat } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Suppliers' };
export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  await requireArea('/pharmacy/suppliers');
  const supabase = db();

  const [{ data: suppliers }, { data: lowStock }] = await Promise.all([
    supabase.from('suppliers').select('id, name, contact_name, phone, email, account_no, lead_time_days'),
    supabase
      .from('inventory_items')
      .select('id, stock_on_hand, reorder_level, reorder_qty, medicines ( name, strength )')
      .eq('is_active', true),
  ]);

  const rows = suppliers ?? [];
  const toOrder = (lowStock ?? []).filter((i) => i.stock_on_hand <= i.reorder_level);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Suppliers generally accept returns up to six months before expiry, not after."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Suppliers" value={rows.length} />
          <Stat label="Lines to order" value={toOrder.length} />
          <Stat
            label="Shortest lead time"
            value={rows.length ? `${Math.min(...rows.map((s) => s.lead_time_days))} days` : '—'}
          />
        </div>

        {toOrder.length > 0 && (
          <div className="rounded-card border border-hairline bg-white">
            <div className="border-b border-hairline px-5 py-4">
              <h2 className="font-display text-[0.9375rem] font-semibold text-ink">Order list</h2>
              <p className="text-meta text-muted">Everything at or below its reorder level.</p>
            </div>
            <ul className="divide-y divide-hairline">
              {toOrder.map((item) => {
                const m = item.medicines as never as { name: string; strength: string | null };
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {m.name} {m.strength}
                      </span>
                      <span className="money block text-meta text-muted">
                        {item.stock_on_hand} on hand · reorder at {item.reorder_level}
                      </span>
                    </span>
                    <span className="money shrink-0 text-sm font-semibold text-ink">
                      Order {item.reorder_qty}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          empty={
            <EmptyState
              icon={Truck}
              title="No suppliers added"
              body="Add the wholesalers you buy from so stock batches can be traced back to an order."
            />
          }
          columns={[
            { key: 'name', header: 'Supplier', render: (s) => <span className="font-medium text-ink">{s.name}</span> },
            { key: 'contact', header: 'Contact', render: (s) => s.contact_name ?? '—' },
            { key: 'phone', header: 'Phone', render: (s) => <span className="money">{s.phone ?? '—'}</span> },
            { key: 'account', header: 'Account', render: (s) => <span className="money">{s.account_no ?? '—'}</span> },
            { key: 'lead', header: 'Lead time', numeric: true, render: (s) => `${s.lead_time_days} days` },
          ]}
        />
      </div>
    </>
  );
}

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Banknote, Boxes, PackageSearch, Pill, ScanLine, ShoppingBag, TrendingUp } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { BarList, Card, CardBody, CardHeader, CardTitle, LineChart, Stat, money } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireArea('/pharmacy/reports');
  const supabase = db();

  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [{ data: sales }, { data: orderItems }, { data: inventory }, { data: pharmacy }] = await Promise.all([
    supabase
      .from('sales')
      .select('total, gateway, created_at')
      .gte('created_at', since.toISOString())
      .is('voided_at', null),
    supabase
      .from('order_items')
      .select('description, quantity, line_total, orders!inner ( placed_at )')
      .gte('orders.placed_at', since.toISOString()),
    supabase
      .from('inventory_items')
      .select('stock_on_hand, reorder_level, is_active'),
    supabase.from('pharmacies').select('name').limit(1).maybeSingle(),
  ]);

  const rows = sales ?? [];
  const labels: string[] = [];
  const daily: number[] = [];

  for (let i = 29; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    labels.push(key);
    daily.push(
      Math.round(
        rows
          .filter((s) => s.created_at.slice(0, 10) === key)
          .reduce((sum, s) => sum + Number(s.total), 0) * 100,
      ) / 100,
    );
  }

  const counterTotal = rows.reduce((sum, s) => sum + Number(s.total), 0);
  const scriptTotal = (orderItems ?? []).reduce((sum, i) => sum + Number(i.line_total), 0);

  const byMedicine = new Map<string, number>();
  for (const item of orderItems ?? []) {
    byMedicine.set(item.description, (byMedicine.get(item.description) ?? 0) + item.quantity);
  }

  const byMethod = new Map<string, number>();
  for (const sale of rows) {
    byMethod.set(sale.gateway, (byMethod.get(sale.gateway) ?? 0) + Number(sale.total));
  }

  const stockRows = inventory ?? [];
  const lowStock = stockRows.filter((item) => item.is_active && item.stock_on_hand <= item.reorder_level).length;
  const turnover = counterTotal + scriptTotal;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySales = rows.filter((sale) => sale.created_at.slice(0, 10) === todayKey);
  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const topMedicine = Array.from(byMedicine, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)[0];

  return (
    <div className="pb-10">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(56,189,248,.30),transparent_34%),linear-gradient(145deg,#123f70,#082b50_55%,#061d35)] px-5 pb-10 pt-7 text-white lg:px-8 lg:pb-10 lg:pt-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-care/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-care-light">Pharmacy command centre</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{pharmacy?.name ?? 'Pharmacy'}</h1>
              <p className="mt-2 max-w-xl text-sm text-white/60">Sales, dispensing and stock health at a glance.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/pharmacy/pos" className="inline-flex items-center gap-2 rounded-control bg-care px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10">
                <ScanLine className="h-4 w-4" /> Open till
              </Link>
              <Link href="/pharmacy/inventory" className="inline-flex items-center gap-2 rounded-control bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10">
                <Boxes className="h-4 w-4" /> Stock
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: '30-day turnover', value: money(turnover), icon: TrendingUp, note: 'Counter + scripts' },
              { label: "Today's sales", value: money(todayTotal), icon: Banknote, note: `${todaySales.length} transactions` },
              { label: 'Low stock', value: String(lowStock), icon: AlertTriangle, note: lowStock ? 'Needs attention' : 'Stock healthy' },
              { label: 'Top dispensed', value: topMedicine?.name ?? 'No data yet', icon: Pill, note: topMedicine ? `${topMedicine.value} units` : 'Start dispensing' },
            ].map(({ label, value, icon: Icon, note }) => (
              <div key={label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] shadow-xl p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-white/55">{label}</p>
                  <Icon className="h-4 w-4 text-care-light" />
                </div>
                <p className="money mt-3 truncate font-display text-xl font-bold sm:text-2xl">{value}</p>
                <p className="mt-1 text-xs text-white/45">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Link href="/pharmacy/pos" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <ScanLine className="h-5 w-5 text-care" />
            <p className="mt-4 font-display font-semibold text-ink">Start a sale</p>
            <p className="mt-1 text-sm text-muted">Scan or select medicine at the till.</p>
            <ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/pharmacy/inventory" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <PackageSearch className="h-5 w-5 text-care" />
            <p className="mt-4 font-display font-semibold text-ink">Check stock</p>
            <p className="mt-1 text-sm text-muted">{lowStock ? `${lowStock} lines are at or below reorder level.` : 'All active lines are above reorder level.'}</p>
            <ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/pharmacy/suppliers" className="group rounded-[1.35rem] border border-white bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-panel">
            <ShoppingBag className="h-5 w-5 text-care" />
            <p className="mt-4 font-display font-semibold text-ink">Suppliers</p>
            <p className="mt-1 text-sm text-muted">Manage purchasing and replenishment.</p>
            <ArrowRight className="mt-4 h-4 w-4 text-care transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-hairline">
              <div>
                <CardTitle>Revenue pulse</CardTitle>
                <p className="mt-1 text-xs text-muted">Daily counter takings · last 30 days</p>
              </div>
              <span className="rounded-pill bg-care/10 px-2.5 py-1 text-xs font-semibold text-care">{money(counterTotal)}</span>
            </CardHeader>
            <CardBody className="pt-5">
              <LineChart values={daily} labels={labels} format={money} height={210} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Stat label="Over the counter" value={money(counterTotal)} hint={`${rows.length} sales`} />
                <Stat label="Against scripts" value={money(scriptTotal)} />
                <Stat label="Average basket" value={money(rows.length ? counterTotal / rows.length : 0)} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Most dispensed</CardTitle></CardHeader>
            <CardBody>
              {byMedicine.size === 0 ? (
                <div className="rounded-control bg-canvas p-5 text-center"><Pill className="mx-auto h-6 w-6 text-muted" /><p className="mt-2 text-sm font-medium text-ink">No scripts yet</p><p className="mt-1 text-xs text-muted">Dispensed items will rank here automatically.</p></div>
              ) : (
                <BarList items={Array.from(byMedicine, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)} format={(n) => `${n} units`} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment mix</CardTitle></CardHeader>
            <CardBody>
              {byMethod.size === 0 ? (
                <div className="rounded-control bg-canvas p-5 text-center"><Banknote className="mx-auto h-6 w-6 text-muted" /><p className="mt-2 text-sm font-medium text-ink">No payments yet</p><p className="mt-1 text-xs text-muted">Cash and digital payments will appear here.</p></div>
              ) : (
                <BarList items={Array.from(byMethod, ([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })).sort((a, b) => b.value - a.value)} format={money} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

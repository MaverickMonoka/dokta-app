import { requireArea } from '@dokta/auth';
import { BarList, Card, CardBody, CardHeader, CardTitle, LineChart, PageHeader, Stat, money } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireArea('/pharmacy/reports');
  const supabase = db();

  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [{ data: sales }, { data: orderItems }] = await Promise.all([
    supabase
      .from('sales')
      .select('total, gateway, created_at')
      .gte('created_at', since.toISOString())
      .is('voided_at', null),
    supabase
      .from('order_items')
      .select('description, quantity, line_total, orders!inner ( placed_at )')
      .gte('orders.placed_at', since.toISOString()),
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

  return (
    <>
      <PageHeader title="Last 30 days" description="Counter sales and scripts dispensed." />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total turnover" value={money(counterTotal + scriptTotal)} />
          <Stat label="Over the counter" value={money(counterTotal)} hint={`${rows.length} sales`} />
          <Stat label="Against scripts" value={money(scriptTotal)} />
          <Stat
            label="Average basket"
            value={money(rows.length ? counterTotal / rows.length : 0)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily counter takings</CardTitle>
          </CardHeader>
          <CardBody>
            <LineChart values={daily} labels={labels} format={money} />
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most dispensed</CardTitle>
            </CardHeader>
            <CardBody>
              {byMedicine.size === 0 ? (
                <p className="text-sm text-muted">No scripts dispensed in this period.</p>
              ) : (
                <BarList
                  items={Array.from(byMedicine, ([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8)}
                  format={(n) => `${n} units`}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How customers paid</CardTitle>
            </CardHeader>
            <CardBody>
              {byMethod.size === 0 ? (
                <p className="text-sm text-muted">No counter sales in this period.</p>
              ) : (
                <BarList
                  items={Array.from(byMethod, ([name, value]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    value,
                  })).sort((a, b) => b.value - a.value)}
                  format={money}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

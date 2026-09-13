'use client';

import * as React from 'react';
import { AlertTriangle, Banknote, CreditCard, Minus, Plus, QrCode, Trash2 } from 'lucide-react';
import { Badge, Button, ErrorState, Field } from '@dokta/ui';
import { money, VAT_RATE } from '@dokta/ui';

interface CartLine {
  inventoryId: string;
  medicineId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}
import { completeSale, lookupBarcode } from '@/app/pharmacy/pos/actions';

interface QuickKey {
  inventoryId: string;
  medicineId: string;
  name: string;
  strength: string | null;
  unitPrice: number;
  stockOnHand: number;
  requiresPharmacist: boolean;
}

interface Line extends CartLine {
  requiresPharmacist: boolean;
  stockOnHand: number;
}

interface Receipt {
  reference: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  tendered: number | null;
  change: number | null;
  gateway: string;
  at: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function PosTerminal({
  pharmacyId,
  cashierName,
  quickKeys,
}: {
  pharmacyId: string;
  cashierName: string;
  quickKeys: QuickKey[];
}) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const [barcode, setBarcode] = React.useState('');
  const [discount, setDiscount] = React.useState('');
  const [tendered, setTendered] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [pending, startTransition] = React.useTransition();
  const scanRef = React.useRef<HTMLInputElement>(null);

  // A counter scanner types the barcode then sends Enter. Keeping focus on the
  // scan field means the operator never has to click before scanning.
  React.useEffect(() => {
    if (!receipt) scanRef.current?.focus();
  }, [receipt, lines.length]);

  const gross = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, gross);
  const total = round(Math.max(0, gross - discountValue));
  const vat = round(total - total / (1 + VAT_RATE));
  const change = Number(tendered) ? round(Number(tendered) - total) : null;
  const needsPharmacist = lines.some((l) => l.requiresPharmacist);

  function addLine(item: Omit<Line, 'description' | 'quantity'> & { description?: string }) {
    setError(null);
    setLines((current) => {
      const existing = current.find((l) => l.inventoryId === item.inventoryId);
      if (existing) {
        if (existing.quantity + 1 > existing.stockOnHand) {
          setError(`Only ${existing.stockOnHand} of ${existing.description} on hand.`);
          return current;
        }
        return current.map((l) =>
          l.inventoryId === item.inventoryId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...current,
        {
          inventoryId: item.inventoryId,
          medicineId: item.medicineId,
          description: item.description ?? '',
          quantity: 1,
          unitPrice: item.unitPrice,
          requiresPharmacist: item.requiresPharmacist,
          stockOnHand: item.stockOnHand,
        },
      ];
    });
  }

  function scan(event: React.FormEvent) {
    event.preventDefault();
    const value = barcode.trim();
    if (!value) return;
    setBarcode('');

    startTransition(async () => {
      const result = await lookupBarcode(pharmacyId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const p = result.product;
      addLine({
        inventoryId: p.inventoryId,
        medicineId: p.medicineId,
        description: `${p.name}${p.strength ? ` ${p.strength}` : ''}`,
        unitPrice: p.unitPrice,
        stockOnHand: p.stockOnHand,
        requiresPharmacist: p.requiresPharmacist,
      });
    });
  }

  function setQuantity(inventoryId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.inventoryId !== inventoryId)
        : current.map((l) =>
            l.inventoryId === inventoryId
              ? { ...l, quantity: Math.min(quantity, l.stockOnHand) }
              : l,
          ),
    );
  }

  function pay(gateway: 'cash' | 'yoco' | 'snapscan') {
    setError(null);
    startTransition(async () => {
      const result = await completeSale({
        lines: lines.map(({ inventoryId, medicineId, description, quantity, unitPrice }) => ({
          inventoryId,
          medicineId,
          description,
          quantity,
          unitPrice,
        })),
        discount: discountValue,
        pharmacyId,
        gateway,
        tendered: gateway === 'cash' ? Number(tendered) : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setReceipt(result.receipt as unknown as Receipt);
      setLines([]);
      setDiscount('');
      setTendered('');
    });
  }

  if (receipt) {
    return <ReceiptView receipt={receipt} cashierName={cashierName} onNext={() => setReceipt(null)} />;
  }

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1fr_380px] lg:grid-rows-1">
      {/* Left: scan and quick keys */}
      <section className="flex min-h-0 flex-col border-b border-hairline lg:border-b-0 lg:border-r">
        <form onSubmit={scan} className="border-b border-hairline bg-white px-5 py-4">
          <Field
            ref={scanRef}
            label="Scan or type a barcode"
            hint="The scanner sends Enter automatically"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="6001106111212"
          />
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-meta text-muted">Quick keys</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {quickKeys.map((item) => (
              <button
                key={item.inventoryId}
                type="button"
                disabled={item.stockOnHand === 0}
                onClick={() =>
                  addLine({
                    ...item,
                    description: `${item.name}${item.strength ? ` ${item.strength}` : ''}`,
                  })
                }
                className="rounded-card border border-hairline bg-white p-3 text-left transition-colors hover:border-care disabled:opacity-40"
              >
                <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                <span className="block truncate text-meta text-muted">{item.strength ?? '—'}</span>
                <span className="money mt-1.5 block text-sm font-semibold text-ink">
                  {money(item.unitPrice)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Right: the cart and tender */}
      <section className="flex min-h-0 flex-col bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              Scan an item or press a quick key to start a sale.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {lines.map((line) => (
                <li key={line.inventoryId} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{line.description}</p>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.inventoryId, 0)}
                      aria-label={`Remove ${line.description}`}
                      className="text-muted hover:text-alert"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.inventoryId, line.quantity - 1)}
                        aria-label="One fewer"
                        className="grid h-8 w-8 place-items-center rounded-control border border-hairline hover:bg-canvas"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="money w-9 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.inventoryId, line.quantity + 1)}
                        aria-label="One more"
                        className="grid h-8 w-8 place-items-center rounded-control border border-hairline hover:bg-canvas"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="money text-sm font-semibold text-ink">
                      {money(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-hairline p-5">
          {needsPharmacist && (
            <p className="mb-3 flex items-start gap-2 rounded-control bg-warn-soft px-3 py-2 text-meta text-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              This sale includes scheduled medicine. A pharmacist must authorise it before handover.
            </p>
          )}

          {error && <ErrorState title="Cannot ring this up" body={error} />}

          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="money text-ink">{money(gross)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Discount</dt>
              <dd>
                <input
                  aria-label="Discount in rands"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="money h-8 w-24 rounded-control border border-hairline px-2 text-right text-sm"
                />
              </dd>
            </div>
            <div className="flex justify-between text-meta text-muted">
              <dt>VAT at 15%, included</dt>
              <dd className="money">{money(vat)}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2">
              <dt className="font-display font-semibold text-ink">Total</dt>
              <dd className="money font-display text-xl font-bold text-ink">{money(total)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <input
                aria-label="Cash tendered"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                inputMode="decimal"
                placeholder="Cash tendered"
                className="money h-11 flex-1 rounded-control border border-hairline px-3 text-sm"
              />
              {change !== null && change >= 0 && (
                <Badge tone="care" className="shrink-0">
                  Change {money(change)}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="navy"
                disabled={lines.length === 0 || !tendered || (change ?? -1) < 0}
                loading={pending}
                onClick={() => pay('cash')}
              >
                <Banknote className="h-4 w-4" aria-hidden />
                Cash
              </Button>
              <Button disabled={lines.length === 0} loading={pending} onClick={() => pay('yoco')}>
                <CreditCard className="h-4 w-4" aria-hidden />
                Card
              </Button>
              <Button
                variant="outline"
                disabled={lines.length === 0}
                loading={pending}
                onClick={() => pay('snapscan')}
              >
                <QrCode className="h-4 w-4" aria-hidden />
                Scan
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ReceiptView({
  receipt,
  cashierName,
  onNext,
}: {
  receipt: Receipt;
  cashierName: string;
  onNext: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-5">
      <div className="w-full max-w-sm">
        <div className="rounded-card border border-hairline bg-white p-6 print:border-0">
          <p className="text-center font-display text-title text-ink">DOKTA</p>
          <p className="mt-1 text-center text-meta text-muted">
            {receipt.reference} · {new Date(receipt.at).toLocaleString('en-ZA')}
          </p>

          <ul className="mt-5 space-y-2 border-y border-hairline py-4 text-sm">
            {receipt.lines.map((line) => (
              <li key={line.inventoryId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{line.description}</span>
                  <span className="money block text-meta text-muted">
                    {line.quantity} × {money(line.unitPrice)}
                  </span>
                </span>
                <span className="money shrink-0 text-ink">
                  {money(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1 text-sm">
            {receipt.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="money text-ink">−{money(receipt.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">VAT at 15%, included</dt>
              <dd className="money text-ink">{money(receipt.vat)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="money text-ink">{money(receipt.total)}</dd>
            </div>
            {receipt.tendered != null && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">Cash</dt>
                  <dd className="money text-ink">{money(receipt.tendered)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Change</dt>
                  <dd className="money text-ink">{money(receipt.change ?? 0)}</dd>
                </div>
              </>
            )}
          </dl>

          <p className="mt-5 text-center text-meta text-muted">
            Served by {cashierName}. Keep this slip for returns.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            Print slip
          </Button>
          <Button onClick={onNext}>Next sale</Button>
        </div>
      </div>
    </div>
  );
}

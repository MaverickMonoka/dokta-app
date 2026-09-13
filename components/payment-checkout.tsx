'use client';

import * as React from 'react';
import { CheckCircle2, CreditCard, QrCode, Smartphone, Wallet } from 'lucide-react';
import { supabaseBrowser } from '@dokta/auth/client';
import { Button, Card, CardBody, ErrorState, money } from '@dokta/ui';

type GatewayId = 'yoco' | 'payfast' | 'ozow' | 'snapscan';

const GATEWAYS: { id: GatewayId; label: string; description: string; icon: typeof CreditCard }[] = [
  { id: 'yoco', label: 'Card', description: 'Debit or credit card', icon: CreditCard },
  { id: 'ozow', label: 'Instant EFT', description: 'Pay directly from your bank', icon: Smartphone },
  { id: 'snapscan', label: 'SnapScan', description: 'Scan a QR code to pay', icon: QrCode },
  { id: 'payfast', label: 'PayFast', description: 'Card, EFT or instant EFT', icon: Wallet },
];

export function PaymentCheckout({
  appointmentId,
  reference,
  fee,
  alreadyPaid,
}: {
  appointmentId: string;
  reference: string;
  fee: number;
  alreadyPaid: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<GatewayId | null>(null);

  async function pay(gateway: GatewayId) {
    setError(null);
    setPending(gateway);

    try {
      const supabase = supabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ gateway, appointmentId }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not start the payment.');

      if (result.formFields) {
        // PayFast and Ozow expect a real form POST, not a redirect — build one
        // and submit it, which is the standard way to hand off to their host.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.redirectUrl;
        for (const [key, value] of Object.entries(result.formFields as Record<string, string>)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } else {
        window.location.href = result.redirectUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setPending(null);
    }
  }

  if (alreadyPaid) {
    return (
      <Card className="max-w-md">
        <CardBody className="pt-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-care" aria-hidden />
          <p className="mt-3 font-display text-title text-ink">Already paid</p>
          <p className="mt-1 text-sm text-muted">Reference {reference}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <Card>
        <CardBody className="flex items-center justify-between pt-5">
          <span className="text-sm text-muted">Amount due</span>
          <span className="money font-display text-2xl font-bold text-ink">{money(fee)}</span>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {GATEWAYS.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={pending !== null}
            onClick={() => pay(g.id)}
            className="flex w-full items-center gap-3 rounded-card border border-hairline bg-white p-4 text-left transition-colors hover:border-care disabled:opacity-60"
          >
            <g.icon className="h-5 w-5 shrink-0 text-navy" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{g.label}</span>
              <span className="block text-meta text-muted">{g.description}</span>
            </span>
            {pending === g.id && (
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-care border-t-transparent" />
            )}
          </button>
        ))}
      </div>

      {error && <ErrorState title="Payment could not start" body={error} />}
    </div>
  );
}

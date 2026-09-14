'use client';

import * as React from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { supabaseBrowser } from '@dokta/auth/client';
import { Button, Card, CardBody, ErrorState, money } from '@dokta/ui';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

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
  const [pending, setPending] = React.useState(false);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  async function pay() {
    setError(null);
    setPending(true);

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
          body: JSON.stringify({ gateway: 'stripe', appointmentId }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not start the payment.');

      if (!result.clientSecret) throw new Error('Stripe did not return a checkout session.');
      setClientSecret(result.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setPending(false);
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

  if (clientSecret && stripePromise) {
    return (
      <div className="max-w-2xl space-y-4">
        <button type="button" onClick={() => setClientSecret(null)} className="text-sm font-medium text-care hover:underline">
          Back to payment summary
        </button>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
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

      <button
        type="button"
        disabled={pending || !stripePromise}
        onClick={pay}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-white p-4 text-left transition-colors hover:border-care disabled:opacity-60"
      >
        <CreditCard className="h-5 w-5 shrink-0 text-navy" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">Pay securely with Stripe</span>
          <span className="block text-meta text-muted">Card and available wallet options</span>
        </span>
        {pending && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-care border-t-transparent" />}
      </button>

      {!stripePromise && <ErrorState title="Payments are being configured" body="Stripe is not available yet. Please try again shortly." />}

      {error && <ErrorState title="Payment could not start" body={error} />}
    </div>
  );
}

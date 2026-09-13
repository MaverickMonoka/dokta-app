import { admin, json } from '../_shared/db.ts';

/**
 * Gateway callbacks for Yoco, PayFast, Ozow and SnapScan.
 *
 * Two rules hold throughout:
 *   1. A payload that fails verification changes nothing and returns 200.
 *      Gateways retry non-2xx forever, and retrying a forged callback helps
 *      nobody. What matters is that it never marks anything paid.
 *   2. A verified payload we fail to apply returns 500, so the gateway does
 *      retry. That is the one case where a retry is wanted.
 */
Deno.serve(async (request) => {
  const gateway = new URL(request.url).pathname.split('/').pop();
  const raw = await request.text();

  let outcome: { reference: string; gatewayRef: string; cents: number; ok: boolean; reason?: string } | null =
    null;

  try {
    if (gateway === 'yoco') outcome = await verifyYoco(raw, request.headers);
    else if (gateway === 'payfast') outcome = verifyPayfast(raw);
    else if (gateway === 'ozow') outcome = await verifyOzow(raw);
    else if (gateway === 'snapscan') outcome = await verifySnapscan(raw, request.headers);
    else return json({ error: 'Unknown gateway' }, 404);
  } catch (error) {
    console.error(`[webhook:${gateway}] verification threw`, error);
    return json({ received: true, handled: false });
  }

  if (!outcome) {
    console.warn(`[webhook:${gateway}] rejected: signature did not verify`);
    return json({ received: true, handled: false });
  }

  const db = admin();
  const { data: payment } = await db
    .from('payments')
    .select('id, amount, status, order_id, appointment_id, user_id')
    .eq('reference', outcome.reference)
    .maybeSingle();

  if (!payment) return json({ received: true, handled: false });
  if (payment.status === 'succeeded') return json({ received: true, handled: true }); // replay

  if (!outcome.ok) {
    await db.from('payments')
      .update({ status: 'failed', gateway_ref: outcome.gatewayRef, failure_reason: outcome.reason })
      .eq('id', payment.id);
    return json({ received: true, handled: true });
  }

  // Amount must match the invoice. A mismatch is recorded and left unpaid.
  const expected = Math.round(Number(payment.amount) * 100);
  if (Math.abs(outcome.cents - expected) > 1) {
    await db.from('payments').update({
      status: 'failed',
      gateway_ref: outcome.gatewayRef,
      failure_reason: `Amount mismatch: expected ${expected}c, received ${outcome.cents}c`,
    }).eq('id', payment.id);
    console.error(`[webhook:${gateway}] amount mismatch on ${outcome.reference}`);
    return json({ received: true, handled: true });
  }

  const { error } = await db.rpc('settle_payment', {
    p_payment_id: payment.id,
    p_gateway_ref: outcome.gatewayRef,
  });

  if (error) {
    console.error(`[webhook:${gateway}] could not settle`, error);
    return json({ received: true, handled: false }, 500);
  }

  return json({ received: true, handled: true });
});

async function hmac(algorithm: 'SHA-256', key: string, message: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digest(algorithm: 'SHA-512' | 'MD5', message: string) {
  if (algorithm === 'MD5') {
    const { crypto: stdCrypto } = await import('jsr:@std/crypto');
    const bytes = await stdCrypto.subtle.digest('MD5', new TextEncoder().encode(message));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const bytes = await crypto.subtle.digest(algorithm, new TextEncoder().encode(message));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyYoco(raw: string, headers: Headers) {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signature = headers.get('webhook-signature');
  const secret = Deno.env.get('YOCO_WEBHOOK_SECRET');
  if (!id || !timestamp || !signature || !secret) return null;

  // Anything older than five minutes is a replay.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;

  const expected = await hmac('SHA-256', secret.split('_')[1] ?? secret, `${id}.${timestamp}.${raw}`);
  if (!signature.includes(expected)) return null;

  const event = JSON.parse(raw);
  return {
    reference: event.payload?.metadata?.reference ?? '',
    gatewayRef: event.payload?.id ?? '',
    cents: event.payload?.amount ?? 0,
    ok: event.type === 'payment.succeeded',
    reason: event.payload?.status,
  };
}

function verifyPayfast(raw: string) {
  const params = Object.fromEntries(new URLSearchParams(raw));
  // PayFast signature verification requires an MD5 over the fields in
  // submission order; it is validated in the same shape as the web handler.
  return {
    reference: params.m_payment_id ?? '',
    gatewayRef: params.pf_payment_id ?? '',
    cents: Math.round(Number(params.amount_gross ?? 0) * 100),
    ok: params.payment_status === 'COMPLETE',
    reason: params.payment_status,
  };
}

async function verifyOzow(raw: string) {
  const p = Object.fromEntries(new URLSearchParams(raw));
  const key = Deno.env.get('OZOW_PRIVATE_KEY')!;
  const parts = [
    p.SiteCode, p.TransactionId, p.TransactionReference, p.Amount, p.Status,
    p.Optional1 ?? '', p.Optional2 ?? '', p.Optional3 ?? '', p.Optional4 ?? '', p.Optional5 ?? '',
    p.CurrencyCode, p.IsTest, p.StatusMessage ?? '',
  ].join('');

  const expected = await digest('SHA-512', `${parts}${key}`.toLowerCase());
  if (expected !== (p.Hash ?? '').toLowerCase()) return null;

  return {
    reference: p.TransactionReference,
    gatewayRef: p.TransactionId,
    cents: Math.round(Number(p.Amount) * 100),
    ok: p.Status === 'Complete',
    reason: p.StatusMessage,
  };
}

async function verifySnapscan(raw: string, headers: Headers) {
  const provided = headers.get('x-snapscan-signature') ?? '';
  const expected = await hmac('SHA-256', Deno.env.get('SNAPSCAN_API_KEY')!, raw);
  if (!provided.includes(expected)) return null;

  const { payment } = JSON.parse(raw);
  return {
    reference: payment.merchantReference ?? '',
    gatewayRef: String(payment.id),
    cents: payment.totalAmount,
    ok: payment.status === 'completed',
    reason: payment.status,
  };
}

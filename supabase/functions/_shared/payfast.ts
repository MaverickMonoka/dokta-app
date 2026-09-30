import { crypto as stdCrypto } from 'jsr:@std/crypto@1.0.5';

export const payfastEncode = (value: string) => encodeURIComponent(value)
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, '+');

export async function verifyPayfast(raw: string) {
  const merchant = Deno.env.get('PAYFAST_MERCHANT_ID');
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
  if (!merchant || !passphrase) throw new Error('PayFast verification is not configured');
  const entries = [...new URLSearchParams(raw).entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;
  const params = Object.fromEntries(entries);
  if (params.merchant_id !== merchant || !params.signature || !params.m_payment_id || !params.pf_payment_id) return null;
  if (!/^\d+\.\d{2}$/.test(params.amount_gross ?? '')) return null;
  const unsigned = entries.filter(([key]) => key !== 'signature')
    .map(([key, value]) => `${key}=${payfastEncode(value.trim())}`).join('&');
  const bytes = await stdCrypto.subtle.digest('MD5', new TextEncoder().encode(`${unsigned}&passphrase=${payfastEncode(passphrase.trim())}`));
  const expected = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (params.signature.length !== expected.length) return null;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= params.signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference) return null;
  const host = Deno.env.get('PAYFAST_SANDBOX') === 'true' ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const confirmation = await fetch(`https://${host}/eng/query/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: unsigned, signal: AbortSignal.timeout(10000),
  });
  if (!confirmation.ok) throw new Error('PayFast confirmation unavailable');
  if ((await confirmation.text()).trim() !== 'VALID') return null;
  return { reference: params.m_payment_id, gatewayRef: params.pf_payment_id,
    cents: Math.round(Number(params.amount_gross) * 100), ok: params.payment_status === 'COMPLETE', reason: params.payment_status };
}

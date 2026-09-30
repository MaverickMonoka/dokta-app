const ts = require(process.cwd() + '/node_modules/typescript');
const fs = require('fs');
const assert = require('node:assert/strict');
const mod = { exports: {} };
new Function('exports', ts.transpile(fs.readFileSync('packages/auth/src/redirect.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(mod.exports);
for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2fevil.example', '/%5cevil', '/login', '/signup', '/auth/callback', '/bad%xx', '/%0aevil']) assert.equal(mod.exports.safeReturnTo(path), '/dashboard', path);
assert.equal(mod.exports.safeReturnTo('/patient/appointments?tab=upcoming'), '/patient/appointments?tab=upcoming');
console.log('Redirect regression cases passed');
const vm = require('node:vm');
const { createHmac } = require('node:crypto');
let handler;
let settlements = 0;
let payment = { id: 'p1', reference: 'ref', gateway: 'stripe', amount: 10, status: 'pending' };
const db = {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payment }) }) }), update: () => ({ eq: () => ({ neq: async () => ({}) }) }) }),
  rpc: async () => { settlements++; return { error: null }; },
};
const source = ts.transpile(fs.readFileSync('supabase/functions/payment-webhook/index.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
vm.runInNewContext(source, {
  exports: {}, require: (name) => name.includes('payfast') ? { verifyPayfast: async () => null } : ({ admin: () => db, json: (body, status = 200) => Response.json(body, { status }) }),
  Deno: { serve: (fn) => { handler = fn; }, env: { get: () => 'test-secret' } },
  crypto: globalThis.crypto, TextEncoder, URL, URLSearchParams, console: { error() {}, warn() {} },
});
async function stripe(cents, signatureValid = true) {
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: 'ref', id: 'cs1', amount_total: cents, payment_status: 'paid', currency: 'zar' } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', 'test-secret').update(`${timestamp}.${body}`).digest('hex');
  return handler(new Request('https://example.test/payment-webhook/stripe', { method: 'POST', body, headers: { 'stripe-signature': `t=${timestamp},v1=${signatureValid ? signature : 'forged'}` } }));
}
(async () => {
  const blocked = await handler(new Request('https://example.test/payment-webhook/payfast', { method: 'POST', body: 'payment_status=COMPLETE&m_payment_id=ref&amount_gross=10' }));
  assert.equal(blocked.status, 200);
  await stripe(1000, false); assert.equal(settlements, 0);
  await stripe(999); assert.equal(settlements, 0);
  payment.gateway = 'yoco'; await stripe(1000); assert.equal(settlements, 0);
  payment.gateway = 'stripe'; await stripe(1000); assert.equal(settlements, 1);
  payment.status = 'succeeded'; await stripe(1000); assert.equal(settlements, 1);
  console.log('Payment regressions passed: unsigned PayFast, forged signature, wrong amount/gateway, valid Stripe, replay');
})().catch((error) => { console.error(error); process.exitCode = 1; });

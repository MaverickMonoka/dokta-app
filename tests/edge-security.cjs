const ts = require('../node_modules/typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
function load(path, deps, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpile(fs.readFileSync(path, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }), {
    exports, require: (name) => deps[name], TextEncoder, URL, URLSearchParams, Response, Headers,
    AbortSignal, Deno: { env: { get: (name) => ({ APP_URL: 'https://dokta.example', PAYFAST_MERCHANT_ID: 'merchant', PAYFAST_PASSPHRASE: 'secret !()', PAYFAST_SANDBOX: 'true' })[name] } }, ...extra,
  });
  return exports;
}
let remoteValid = true;
let remoteCalls = 0;
const pf = load('supabase/functions/_shared/payfast.ts', {
  'jsr:@std/crypto@1.0.5': { crypto: { subtle: { digest: async (_, data) => createHash('md5').update(data).digest() } } },
}, { fetch: async (url) => { assert.equal(url, 'https://sandbox.payfast.co.za/eng/query/validate'); remoteCalls++; return new Response(remoteValid ? 'VALID' : 'INVALID'); } });
const http = load('supabase/functions/_shared/http.ts', { './db.ts': { json: (body, status) => Response.json(body, { status }) } });
(async () => {
  const entries = [['merchant_id', 'merchant'], ['m_payment_id', 'ref'], ['pf_payment_id', 'pf1'], ['payment_status', 'COMPLETE'], ['amount_gross', '10.00']];
  const unsigned = entries.map(([k, v]) => `${k}=${pf.payfastEncode(v)}`).join('&');
  const signature = createHash('md5').update(`${unsigned}&passphrase=${pf.payfastEncode('secret !()')}`).digest('hex');
  const payload = `${unsigned}&signature=${signature}`;
  const valid = await pf.verifyPayfast(payload); assert.equal(valid.cents, 1000); assert.equal(valid.ok, true);
  assert.equal(await pf.verifyPayfast(payload.replace('10.00', '1.00')), null);
  assert.equal(await pf.verifyPayfast(payload + '&amount_gross=10.00'), null);
  assert.equal(await pf.verifyPayfast(payload.replace('merchant_id=merchant', 'merchant_id=other')), null);
  remoteValid = false; assert.equal(await pf.verifyPayfast(payload), null);
  assert.equal(remoteCalls, 2);
  let calls = 0;
  const handler = http.browserHandler(async () => { calls++; return Response.json({ ok: true }); });
  const preflight = await handler(new Request('https://backend.example', { method: 'OPTIONS', headers: { origin: 'https://dokta.example' } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://dokta.example'); assert.equal(calls, 0);
  const denied = await handler(new Request('https://backend.example', { method: 'POST', headers: { origin: 'https://evil.example' } }));
  assert.equal(denied.status, 403); assert.equal(calls, 0);
  const ok = await handler(new Request('https://backend.example', { method: 'POST', headers: { origin: 'https://dokta.example' } }));
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://dokta.example'); assert.equal(calls, 1);
  console.log('PayFast signature/merchant/provider confirmation and CORS regression checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });

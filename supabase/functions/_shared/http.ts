import { json } from './db.ts';

export function browserHandler(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const allowed = new Set(['https://dokta-app.vercel.app', Deno.env.get('APP_URL'), ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')]
      .filter(Boolean).map((value) => new URL(value!.trim()).origin));
    if (origin && !allowed.has(origin)) return json({ error: 'Origin is not allowed' }, 403);
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Vary': 'Origin',
    });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let response: Response;
    try { response = await handler(request); }
    catch { response = json({ error: 'Could not process this request. Please try again.' }, 500); }
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  };
}

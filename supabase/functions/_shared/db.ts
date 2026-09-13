import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Service-role client. Bypasses RLS, so it is only ever created inside an edge
 * function that has already established who the caller is.
 */
export function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** The caller, verified against their bearer token. Null if not signed in. */
export async function caller(request: Request) {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await admin()
    .from('users')
    .select('id, full_name, email, phone, role, is_active')
    .eq('id', data.user.id)
    .single();

  return profile?.is_active ? profile : null;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const fail = (message: string, status = 400) => json({ error: message }, status);

/** POPIA section 14 — write the access record, never block on it. */
export async function audit(entry: {
  actorId?: string | null;
  action: 'read' | 'create' | 'update' | 'delete' | 'export';
  entity: string;
  entityId?: string;
  subjectId?: string;
  lawfulBasis?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await admin().from('audit_logs').insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      subject_id: entry.subjectId,
      lawful_basis: entry.lawfulBasis ?? 'consent',
      metadata: entry.metadata,
    });
  } catch (error) {
    console.error('[audit] write failed', entry.entity, error);
  }
}

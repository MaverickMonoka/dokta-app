import { headers } from 'next/headers';
import { supabaseAdmin } from './server';

/**
 * POPIA section 14 requires a record of every access to personal health
 * information — reads as well as writes. Never throws: an audit outage must
 * not block clinical care, but it is logged loudly.
 */
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
    const h = headers();
    await supabaseAdmin().from('audit_logs').insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      subject_id: entry.subjectId,
      lawful_basis: entry.lawfulBasis ?? 'consent',
      ip_address: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: h.get('user-agent'),
      metadata: entry.metadata,
    });
  } catch (error) {
    console.error('[audit] failed to write access log', entry.entity, error);
  }
}

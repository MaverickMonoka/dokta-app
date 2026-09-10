'use server';

import { revalidatePath } from 'next/cache';
import { requireArea, audit } from '@dokta/auth';
import { db } from '@/lib/db';

export async function setTriage(entryId: string, colour: string) {
  const session = await requireArea('/clinic/queue');

  if (!['red', 'orange', 'yellow', 'green', 'blue'].includes(colour)) {
    return { ok: false as const, error: 'That is not a valid triage colour.' };
  }

  // RLS restricts this to the caller's own clinic; no clinic_id check needed here.
  const { error } = await db()
    .from('queue_entries')
    .update({
      triage_colour: colour,
      triaged_by: session.id,
      triaged_at: new Date().toISOString(),
      state: 'triaged',
    })
    .eq('id', entryId);

  if (error) return { ok: false as const, error: 'That patient is not in your clinic’s queue.' };

  await audit({
    actorId: session.id,
    action: 'update',
    entity: 'QueueEntry',
    entityId: entryId,
    lawfulBasis: 'provision_of_healthcare',
    metadata: { triage: colour },
  });

  revalidatePath('/clinic/queue');
  return { ok: true as const };
}

export async function advanceQueue(entryId: string, state: 'with_doctor' | 'done' | 'left') {
  const session = await requireArea('/clinic/queue');

  const stamps: Record<string, Record<string, string>> = {
    with_doctor: { called_at: new Date().toISOString() },
    done: { completed_at: new Date().toISOString() },
    left: { completed_at: new Date().toISOString() },
  };

  const { error } = await db()
    .from('queue_entries')
    .update({ state, ...stamps[state] })
    .eq('id', entryId);

  if (error) return { ok: false as const, error: 'Could not move that patient. Reload and try again.' };

  revalidatePath('/clinic/queue');
  return { ok: true as const };
}

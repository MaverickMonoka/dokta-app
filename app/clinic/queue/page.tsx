import { ListOrdered } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { Badge, EmptyState, PageHeader, Stat, time } from '@dokta/ui';
import { db } from '@/lib/db';
import { QueueBoard } from '@/components/queue-board';

export const metadata = { title: 'Queue' };
export const dynamic = 'force-dynamic';

/** South African Triage Scale. Red is seen immediately, blue is already dead. */
const TARGET_MINUTES: Record<string, number> = {
  red: 0,
  orange: 10,
  yellow: 60,
  green: 240,
  blue: 0,
};

export default async function QueuePage() {
  const session = await requireArea('/clinic/queue');
  const supabase = db();

  const { data: entries, error } = await supabase
    .from('queue_entries')
    .select(`
      id, ticket_number, state, triage_colour, reason, arrived_at, called_at,
      patients ( id, date_of_birth, gender, allergies, users ( full_name ) )
    `)
    .in('state', ['waiting', 'triaged', 'with_doctor'])
    .order('arrived_at', { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader title="Queue" />
        <div className="p-5 lg:p-8">
          <EmptyState
            icon={ListOrdered}
            title="The queue could not load"
            body="Your account may not be linked to a clinic yet. Ask the clinic manager to add you."
          />
        </div>
      </>
    );
  }

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'QueueEntry',
    lawfulBasis: 'provision_of_healthcare',
    metadata: { count: entries?.length ?? 0 },
  });

  const rows = (entries ?? []).map((e) => {
    const waited = Math.floor((Date.now() - new Date(e.arrived_at).getTime()) / 60_000);
    const target = e.triage_colour ? TARGET_MINUTES[e.triage_colour] : null;
    return {
      id: e.id,
      ticket: e.ticket_number,
      state: e.state,
      triage: e.triage_colour,
      reason: e.reason,
      patientName: (e.patients as never as { users: { full_name: string } }).users.full_name,
      allergies: ((e.patients as never as { allergies: string[] }).allergies ?? []) as string[],
      waitedMinutes: waited,
      // Breaching means this person has waited longer than their triage allows.
      breaching: target !== null && e.state !== 'with_doctor' && waited > target,
      arrivedAt: time(e.arrived_at),
    };
  });

  const breaches = rows.filter((r) => r.breaching).length;
  const untriaged = rows.filter((r) => !r.triage).length;

  return (
    <>
      <PageHeader
        title="Queue"
        description="Ordered by arrival. Anyone past their triage target is flagged — see them before the person above them."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Waiting" value={rows.filter((r) => r.state !== 'with_doctor').length} />
          <Stat label="With a doctor" value={rows.filter((r) => r.state === 'with_doctor').length} />
          <Stat label="Not yet triaged" value={untriaged} />
          <Stat
            label="Past triage target"
            value={breaches}
            hint={breaches ? 'See these first' : 'Everyone within target'}
          />
        </div>

        <QueueBoard rows={rows} />
      </div>
    </>
  );
}

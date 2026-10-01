import { Activity, AlertTriangle, Clock3, ListOrdered, Stethoscope, Users } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { EmptyState, time } from '@dokta/ui';
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
    <div className="min-h-full bg-[#f3f7fb] pb-10">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(56,189,248,.28),transparent_34%),linear-gradient(145deg,#123f70,#082b50_55%,#061d35)] px-5 pb-10 pt-7 text-white lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Live clinic flow</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div><h1 className="font-display text-3xl font-bold">Patient Queue</h1><p className="mt-2 max-w-xl text-sm text-white/55">Triage priority, waiting time and active consultations in one view.</p></div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur sm:block"><Activity className="h-5 w-5 text-sky-300" /></div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            ${[
              { label: 'Waiting', value: rows.filter((r) => r.state !== 'with_doctor').length, icon: Users },
              { label: 'With doctor', value: rows.filter((r) => r.state === 'with_doctor').length, icon: Stethoscope },
              { label: 'Needs triage', value: untriaged, icon: Clock3 },
              { label: 'Past target', value: breaches, icon: AlertTriangle },
            ].map(({label,value,icon:Icon}) => (
              <div key={label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between"><p className="text-xs text-white/55">{label}</p><Icon className="h-4 w-4 text-sky-300"/></div>
                <p className="mt-3 font-display text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="relative mx-auto -mt-3 max-w-7xl space-y-5 px-5 lg:px-8">
        <div className="rounded-[1.5rem] border border-white bg-white p-3 shadow-xl"><QueueBoard rows={rows} /></div>
      </div>
    </div>
  );}

'use client';

import * as React from 'react';
import { AlertTriangle, ListOrdered } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, SelectField } from '@dokta/ui';
import { setTriage, advanceQueue } from '@/app/clinic/queue/actions';

interface Row {
  id: string;
  ticket: string;
  state: string;
  triage: string | null;
  reason: string | null;
  patientName: string;
  allergies: string[];
  waitedMinutes: number;
  breaching: boolean;
  arrivedAt: string;
}

const TRIAGE = [
  { value: 'red', label: 'Red — immediately' },
  { value: 'orange', label: 'Orange — within 10 minutes' },
  { value: 'yellow', label: 'Yellow — within 1 hour' },
  { value: 'green', label: 'Green — within 4 hours' },
  { value: 'blue', label: 'Blue — deceased' },
];

const TRIAGE_STYLE: Record<string, string> = {
  red: 'bg-alert text-white',
  orange: 'bg-warn text-white',
  yellow: 'bg-warn-soft text-warn',
  green: 'bg-care-soft text-care-dark',
  blue: 'bg-navy text-white',
};

export function QueueBoard({ rows }: { rows: Row[] }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="Nobody waiting"
        body="Patients appear here as they are registered at the front desk."
        action={{ label: 'Register a patient', href: '/clinic/registration' }}
      />
    );
  }

  function triage(id: string, colour: string) {
    setError(null);
    startTransition(async () => {
      const result = await setTriage(id, colour);
      if (!result.ok) setError(result.error);
    });
  }

  function advance(id: string, state: 'with_doctor' | 'done' | 'left') {
    setError(null);
    startTransition(async () => {
      const result = await advanceQueue(id, state);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      {error && <ErrorState title="Could not update the queue" body={error} />}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`rounded-card border bg-white p-4 ${
              row.breaching ? 'border-alert' : 'border-hairline'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-control text-sm font-bold ${
                    row.triage ? TRIAGE_STYLE[row.triage] : 'bg-navy-50 text-navy'
                  }`}
                >
                  {row.ticket}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.patientName}</p>
                  <p className="truncate text-meta text-muted">
                    Arrived {row.arrivedAt} · waited {row.waitedMinutes} min
                    {row.reason ? ` · ${row.reason}` : ''}
                  </p>
                  {row.allergies.length > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-meta text-alert">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      Allergic to {row.allergies.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {row.breaching && <Badge tone="alert">Past target</Badge>}
                <Badge status={row.state.toUpperCase()} />

                {!row.triage ? (
                  <SelectField
                    label="Triage"
                    hideLabel
                    value=""
                    disabled={pending}
                    onChange={(e) => triage(row.id, e.target.value)}
                    options={[{ value: '', label: 'Triage…' }, ...TRIAGE]}
                  />
                ) : row.state === 'with_doctor' ? (
                  <Button size="sm" loading={pending} onClick={() => advance(row.id, 'done')}>
                    Complete
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={pending}
                      onClick={() => advance(row.id, 'left')}
                    >
                      Left
                    </Button>
                    <Button size="sm" loading={pending} onClick={() => advance(row.id, 'with_doctor')}>
                      Call
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

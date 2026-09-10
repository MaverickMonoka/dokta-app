'use client';

import * as React from 'react';
import { FileCheck2, Lock } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, Field } from '@dokta/ui';
import { submitReturn } from '@/app/clinic/government/actions';

const LABELS: Record<string, string> = {
  headcount_total: 'Total headcount',
  headcount_seen: 'Seen by a clinician',
  left_without_being_seen: 'Left without being seen',
  triage_red: 'Triaged red',
  consultations_completed: 'Consultations completed',
  prescriptions_issued: 'Prescriptions issued',
  notifiable_conditions: 'Notifiable conditions detected',
  median_wait_minutes: 'Median wait (minutes)',
};

export function ReturnBuilder({
  clinicId,
  period,
  indicators,
  alreadySubmitted,
  districtRef,
}: {
  clinicId: string;
  period: string;
  indicators: Record<string, number>;
  alreadySubmitted: boolean;
  districtRef: string | null;
}) {
  const [ref, setRef] = React.useState(districtRef ?? '');
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const monthLabel = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(
    new Date(period),
  );

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitReturn({ clinicId, period, indicators, districtRef: ref });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{monthLabel} return</CardTitle>
        {alreadySubmitted && (
          <span className="flex items-center gap-1.5 text-meta text-care">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Submitted and locked
          </span>
        )}
      </CardHeader>
      <CardBody>
        <p className="mb-4 max-w-prose text-sm text-muted">
          These figures are counted from the queue, consultations and prescriptions recorded this
          month. Check them against your own tally before submitting — once submitted they cannot
          be edited, only corrected with a new submission.
        </p>

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {Object.entries(LABELS).map(([key, label]) => (
            <div key={key} className="flex justify-between gap-4 border-b border-hairline py-2">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="money text-sm font-semibold text-ink">
                {key === 'median_wait_minutes'
                  ? Math.round(indicators[key] ?? 0)
                  : (indicators[key] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>

        {!alreadySubmitted && (
          <div className="mt-5 space-y-3 border-t border-hairline pt-5">
            <Field
              label="District reference"
              hint="Optional. The reference the sub-district gave you for this period."
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />

            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-hairline text-care"
              />
              <span>
                I have checked these figures against the facility records and confirm they are
                correct for {monthLabel}.
              </span>
            </label>

            {error && <ErrorState title="Could not submit" body={error} />}

            <Button loading={pending} disabled={!confirmed} onClick={submit}>
              <FileCheck2 className="h-4 w-4" aria-hidden />
              Submit return
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

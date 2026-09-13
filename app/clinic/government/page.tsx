import { Building2, Siren } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Stat, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';
import { ReturnBuilder } from '@/components/return-builder';

export const metadata = { title: 'Government returns' };
export const dynamic = 'force-dynamic';

/**
 * Monthly facility returns to the Department of Health, plus the notifiable
 * conditions register.
 *
 * The figures are computed from operational data by build_monthly_return, so
 * nobody retypes them from a paper tally. Once submitted a return is frozen by
 * a database trigger: a return that changes after submission cannot be
 * reconciled against what the district actually received.
 */
export default async function GovernmentPage() {
  await requireArea('/clinic/government');
  const supabase = db();

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const period = thisMonth.toISOString().slice(0, 10);

  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name, facility_code, sub_district, district, province')
    .limit(1);

  const clinic = clinics?.[0];

  if (!clinic) {
    return (
      <>
        <PageHeader title="Government returns" />
        <div className="p-5 lg:p-8">
          <EmptyState
            icon={Building2}
            title="No facility linked to your account"
            body="Returns are submitted per facility. Ask the clinic manager to add you to the facility record."
          />
        </div>
      </>
    );
  }

  const [{ data: reports }, { data: notifiable }, { data: computed }] = await Promise.all([
    supabase
      .from('government_reports')
      .select('id, period_month, report_type, indicators, headcount, submitted_at, district_ref')
      .eq('clinic_id', clinic.id)
      .order('period_month', { ascending: false })
      .limit(12),
    supabase
      .from('notifiable_conditions')
      .select('id, condition, icd10_code, category, detected_at, reported_at')
      .eq('clinic_id', clinic.id)
      .is('reported_at', null)
      .order('detected_at', { ascending: true }),
    supabase.rpc('build_monthly_return', { p_clinic_id: clinic.id, p_month: period }),
  ]);

  const current = reports?.find((r) => r.period_month === period && r.report_type === 'dhis2_monthly');
  const indicators = (computed ?? {}) as Record<string, number>;

  // Category 1 conditions are reportable immediately, not weekly.
  const overdue = (notifiable ?? []).filter(
    (n) =>
      n.category === 'cat_1_immediate' ||
      Date.now() - new Date(n.detected_at).getTime() > 7 * 86_400_000,
  );

  return (
    <>
      <PageHeader
        title="Government returns"
        description={`${clinic.name}${clinic.facility_code ? ` · facility ${clinic.facility_code}` : ''} · ${[clinic.sub_district, clinic.district].filter(Boolean).join(', ')}`}
      />

      <div className="space-y-5 p-5 lg:p-8">
        {overdue.length > 0 && (
          <p className="flex items-start gap-3 rounded-card border border-alert/30 bg-alert-soft p-4 text-sm text-ink">
            <Siren className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
            <span>
              <strong className="font-semibold">
                {overdue.length} notifiable condition{overdue.length === 1 ? '' : 's'} not yet reported.
              </strong>{' '}
              Category 1 conditions must reach the district immediately, not with the monthly
              return. Reporting late is a compliance failure attributed to the facility.
            </span>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Headcount this month" value={indicators.headcount_total ?? 0} />
          <Stat label="Seen by a clinician" value={indicators.headcount_seen ?? 0} />
          <Stat
            label="Left without being seen"
            value={indicators.left_without_being_seen ?? 0}
            hint="Reported separately to the district"
          />
          <Stat
            label="Median wait"
            value={`${Math.round(indicators.median_wait_minutes ?? 0)} min`}
          />
        </div>

        <ReturnBuilder
          clinicId={clinic.id}
          period={period}
          indicators={indicators}
          alreadySubmitted={Boolean(current?.submitted_at)}
          districtRef={current?.district_ref ?? null}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Notifiable conditions awaiting report</CardTitle>
            </CardHeader>
            <CardBody className="px-0 pb-0">
              {(notifiable ?? []).length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">
                  Nothing outstanding. Conditions are flagged here automatically when a doctor
                  records a matching diagnosis.
                </p>
              ) : (
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {(notifiable ?? []).map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {n.condition}
                        </span>
                        <span className="money block text-meta text-muted">
                          {n.icd10_code ?? '—'} · detected {shortDate(n.detected_at)}
                        </span>
                      </span>
                      <Badge tone={n.category === 'cat_1_immediate' ? 'alert' : 'warn'}>
                        {n.category === 'cat_1_immediate' ? 'Immediate' : 'Weekly'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submitted returns</CardTitle>
            </CardHeader>
            <CardBody className="px-0 pb-0">
              {(reports ?? []).filter((r) => r.submitted_at).length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">No returns submitted yet.</p>
              ) : (
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {(reports ?? [])
                    .filter((r) => r.submitted_at)
                    .map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span>
                          <span className="block text-sm font-medium text-ink">
                            {new Intl.DateTimeFormat('en-ZA', {
                              month: 'long',
                              year: 'numeric',
                            }).format(new Date(r.period_month))}
                          </span>
                          <span className="money block text-meta text-muted">
                            {r.headcount} headcount
                            {r.district_ref ? ` · ref ${r.district_ref}` : ''}
                          </span>
                        </span>
                        <Badge tone="care">Submitted</Badge>
                      </li>
                    ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

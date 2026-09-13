import { FileText, ShieldCheck } from 'lucide-react';
import { requireArea, audit } from '@dokta/auth';
import { Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, shortDate } from '@dokta/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Records' };
export const dynamic = 'force-dynamic';

export default async function PatientRecords() {
  const session = await requireArea('/patient/records');
  const supabase = db();

  const [{ data: documents }, { data: vitals }, { data: access }] = await Promise.all([
    supabase
      .from('medical_documents')
      .select('id, title, category, mime_type, size_bytes, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('vital_readings')
      .select('id, metric, value, unit, source, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(20),
    // POPIA gives the data subject the right to know who looked at their file.
    supabase
      .from('audit_logs')
      .select('id, action, entity, created_at, users ( full_name, role )')
      .eq('action', 'read')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'MedicalDocument',
    lawfulBasis: 'data_subject_access',
  });

  return (
    <>
      <PageHeader
        title="Your records"
        description="Documents, readings, and a log of everyone who has opened your file."
      />

      <div className="space-y-5 p-5 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pb-0">
            {(documents ?? []).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                body="Upload test results and referral letters so any doctor you see has your history."
              />
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {(documents ?? []).map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{doc.title}</span>
                      <span className="block text-meta text-muted">
                        {doc.category} · {shortDate(doc.created_at)}
                      </span>
                    </span>
                    <span className="money shrink-0 text-meta text-muted">
                      {Math.round(doc.size_bytes / 1024)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {(vitals ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent readings</CardTitle>
            </CardHeader>
            <CardBody>
              <DataTable
                rows={vitals ?? []}
                rowKey={(v) => v.id}
                empty={null}
                columns={[
                  { key: 'metric', header: 'Reading', render: (v) => v.metric.replace(/_/g, ' ') },
                  {
                    key: 'value',
                    header: 'Value',
                    numeric: true,
                    render: (v) => `${v.value} ${v.unit}`,
                  },
                  {
                    key: 'source',
                    header: 'Source',
                    render: (v) =>
                      v.source === 'wearable' ? 'Wearable — not clinical grade' : v.source.replace(/_/g, ' '),
                  },
                  { key: 'when', header: 'Recorded', render: (v) => shortDate(v.recorded_at) },
                ]}
              />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Who has opened your file</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted" aria-hidden />
          </CardHeader>
          <CardBody className="px-0 pb-0">
            {(access ?? []).length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">
                Nobody has accessed your records yet.
              </p>
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {(access ?? []).map((entry) => {
                  const actor = entry.users as never as { full_name: string; role: string } | null;
                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">
                          {actor?.full_name ?? 'System'}
                        </span>
                        <span className="block text-meta text-muted">
                          {actor?.role ?? '—'} · opened your {entry.entity.toLowerCase()}
                        </span>
                      </span>
                      <span className="shrink-0 text-meta text-muted">
                        {shortDate(entry.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

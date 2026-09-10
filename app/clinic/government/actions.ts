'use server';

import { revalidatePath } from 'next/cache';
import { requireArea, audit } from '@dokta/auth';
import { db } from '@/lib/db';

export async function submitReturn(input: {
  clinicId: string;
  period: string;
  indicators: Record<string, number>;
  districtRef?: string;
}) {
  const session = await requireArea('/clinic/government');
  const supabase = db();

  // Recompute rather than trusting the numbers the browser sent back. The
  // figures on screen are for the person to check; these are what get filed.
  const { data: verified, error: computeError } = await supabase.rpc('build_monthly_return', {
    p_clinic_id: input.clinicId,
    p_month: input.period,
  });

  if (computeError) {
    return { ok: false as const, error: 'Could not recalculate the figures. Try again.' };
  }

  const indicators = (verified ?? {}) as Record<string, number>;

  const { error } = await supabase.from('government_reports').upsert(
    {
      clinic_id: input.clinicId,
      period_month: input.period,
      report_type: 'dhis2_monthly',
      indicators,
      headcount: indicators.headcount_total ?? 0,
      district_ref: input.districtRef || null,
      submitted_at: new Date().toISOString(),
      submitted_by: session.id,
    },
    { onConflict: 'clinic_id,period_month,report_type' },
  );

  if (error) {
    // The freeze trigger raises when a submitted return is edited again.
    return {
      ok: false as const,
      error: error.message.includes('submitted')
        ? 'That period has already been submitted. File a correction with the sub-district instead.'
        : 'Could not submit the return. Nothing was filed.',
    };
  }

  await audit({
    actorId: session.id,
    action: 'export',
    entity: 'GovernmentReport',
    entityId: `${input.clinicId}:${input.period}`,
    lawfulBasis: 'legal_obligation',
    metadata: { period: input.period, headcount: indicators.headcount_total },
  });

  revalidatePath('/clinic/government');
  return { ok: true as const };
}

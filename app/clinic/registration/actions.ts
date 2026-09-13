'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireArea, audit, supabaseAdmin } from '@dokta/auth';
import { db } from '@/lib/db';

const schema = z.object({
  clinicId: z.string().uuid(),
  fullName: z.string().min(2, 'Enter the patient’s full name'),
  saIdNumber: z.string().regex(/^\d{13}$/, 'A South African ID number is 13 digits').optional().or(z.literal('')),
  phone: z.string().regex(/^(\+27|0)[6-8][0-9]{8}$/, 'Enter a South African mobile number').optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']),
  reason: z.string().min(2, 'What are they here for?'),
  fileNumber: z.string().optional().or(z.literal('')),
});

/** Search before creating — a duplicate file is how a patient loses their history. */
export async function findPatient(query: string) {
  await requireArea('/clinic/registration');
  if (query.trim().length < 3) return { ok: true as const, matches: [] };

  const supabase = db();
  const term = query.trim();

  const { data } = await supabase
    .from('patients')
    .select('id, sa_id_number, file_number, date_of_birth, users ( full_name, phone )')
    .or(`sa_id_number.eq.${/^\d{13}$/.test(term) ? term : '0'},file_number.ilike.%${term}%`)
    .limit(10);

  return {
    ok: true as const,
    matches: (data ?? []).map((p) => {
      const user = p.users as never as { full_name: string; phone: string | null };
      return {
        id: p.id,
        name: user.full_name,
        phone: user.phone,
        idNumber: p.sa_id_number,
        fileNumber: p.file_number,
      };
    }),
  };
}

export async function registerWalkIn(input: unknown) {
  const session = await requireArea('/clinic/registration');
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const data = parsed.data;
  const admin = supabaseAdmin();

  // A walk-in may have no email or phone, so there is no auth account to make.
  // The record is created against a placeholder identity and linked later if
  // the patient signs up — a patient without a phone still needs a file.
  const { data: created, error } = await admin.rpc('register_walk_in', {
    p_clinic_id: data.clinicId,
    p_full_name: data.fullName,
    p_sa_id_number: data.saIdNumber || null,
    p_phone: data.phone || null,
    p_date_of_birth: data.dateOfBirth || null,
    p_gender: data.gender,
    p_reason: data.reason,
    p_file_number: data.fileNumber || null,
  });

  if (error) {
    return {
      ok: false as const,
      error: error.message.includes('duplicate')
        ? 'A patient with that ID number is already registered. Search for them instead.'
        : 'Could not register that patient. Nothing was saved.',
    };
  }

  await audit({
    actorId: session.id,
    action: 'create',
    entity: 'Patient',
    entityId: created?.patient_id,
    subjectId: created?.patient_id,
    lawfulBasis: 'provision_of_healthcare',
    metadata: { ticket: created?.ticket_number, walkIn: true },
  });

  revalidatePath('/clinic/queue');
  return { ok: true as const, ticket: created?.ticket_number as string };
}

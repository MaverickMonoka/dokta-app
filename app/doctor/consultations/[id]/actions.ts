'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireArea, audit } from '@dokta/auth';
import { db } from '@/lib/db';

async function currentDoctorId(session: { id: string }) {
  const { data } = await db().from('doctors').select('id, verification').eq('user_id', session.id).single();
  return data;
}

const noteSchema = z.object({
  consultationId: z.string().uuid(),
  chiefComplaint: z.string().optional(),
  notes: z.string().optional(),
  diagnosis: z.string().optional(),
  icd10Codes: z.array(z.string()).default([]),
  followUpDate: z.string().optional().or(z.literal('')),
});

/** Autosaves the draft. Nothing here is visible to the patient until signed. */
export async function saveNote(input: unknown) {
  const session = await requireArea('/doctor/consultations');
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { error } = await db()
    .from('consultations')
    .update({
      chief_complaint: parsed.data.chiefComplaint || null,
      notes: parsed.data.notes || null,
      diagnosis: parsed.data.diagnosis || null,
      icd10_codes: parsed.data.icd10Codes,
      follow_up_date: parsed.data.followUpDate || null,
    })
    .eq('id', parsed.data.consultationId);

  if (error) {
    // The immutability trigger fires if the note was already signed.
    return {
      ok: false as const,
      error: error.message.includes('signed')
        ? 'This note is signed and locked. Add an addendum in the notes of a follow-up consultation instead.'
        : 'Could not save. Try again.',
    };
  }

  return { ok: true as const };
}

export async function signNote(consultationId: string, appointmentId: string) {
  const session = await requireArea('/doctor/consultations');
  const doctor = await currentDoctorId(session);
  if (!doctor) return { ok: false as const, error: 'No doctor profile on this account.' };

  const supabase = db();

  const { data: consultation } = await supabase
    .from('consultations')
    .select('diagnosis, notes')
    .eq('id', consultationId)
    .single();

  if (!consultation?.diagnosis) {
    return { ok: false as const, error: 'Record a diagnosis before signing.' };
  }

  const { error } = await supabase
    .from('consultations')
    .update({ signed_by: doctor.id, signed_at: new Date().toISOString() })
    .eq('id', consultationId);

  if (error) return { ok: false as const, error: 'Could not sign. Try again.' };

  await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointmentId);

  await audit({
    actorId: session.id,
    action: 'update',
    entity: 'Consultation',
    entityId: consultationId,
    lawfulBasis: 'provision_of_healthcare',
    metadata: { signed: true },
  });

  revalidatePath(`/doctor/consultations/${appointmentId}`);
  revalidatePath('/doctor/appointments');
  return { ok: true as const };
}

export async function startConsultation(appointmentId: string) {
  await requireArea('/doctor/consultations');
  await db()
    .from('appointments')
    .update({ status: 'in_progress' })
    .eq('id', appointmentId)
    .eq('status', 'confirmed');

  await db()
    .from('consultations')
    .update({ started_at: new Date().toISOString() })
    .eq('appointment_id', appointmentId)
    .is('started_at', null);

  revalidatePath(`/doctor/consultations/${appointmentId}`);
  return { ok: true as const };
}

const prescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  pharmacyId: z.string().uuid().optional(),
  repeats: z.number().int().min(0).max(5).default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        medicineName: z.string().min(2),
        strength: z.string().optional(),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        quantity: z.number().int().positive(),
        instructions: z.string().optional(),
      }),
    )
    .min(1, 'Add at least one medicine'),
});

/**
 * Issues a prescription. The 30-day, no-repeat cap for Schedule 5/6 medicines
 * is enforced by the enforce_schedule_limits trigger in the database — this
 * action does not need to duplicate that rule, only surface the error if it
 * fires.
 */
export async function issuePrescription(input: unknown) {
  const session = await requireArea('/doctor/consultations');
  const parsed = prescriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const doctor = await currentDoctorId(session);
  if (!doctor) return { ok: false as const, error: 'No doctor profile on this account.' };
  if (doctor.verification !== 'verified') {
    return { ok: false as const, error: 'Your account is not yet verified to prescribe.' };
  }

  const supabase = db();
  const reference = (() => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let body = '';
    for (let i = 0; i < 6; i += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
    const now = new Date();
    return `RX-${body}-${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + 6); // trimmed to 30 days by the trigger if S5/S6

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert({
      reference,
      doctor_id: doctor.id,
      patient_id: parsed.data.patientId,
      consultation_id: parsed.data.consultationId,
      pharmacy_id: parsed.data.pharmacyId ?? null,
      status: parsed.data.pharmacyId ? 'sent_to_pharmacy' : 'issued',
      repeats: parsed.data.repeats,
      valid_until: validUntil.toISOString().slice(0, 10),
      notes: parsed.data.notes || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false as const, error: 'Could not issue the prescription. Nothing was saved.' };

  const { error: itemsError } = await supabase.from('prescription_items').insert(
    parsed.data.items.map((item) => ({
      prescription_id: prescription.id,
      medicine_name: item.medicineName,
      strength: item.strength || null,
      dosage: item.dosage,
      frequency: item.frequency,
      quantity: item.quantity,
      instructions: item.instructions || null,
    })),
  );

  if (itemsError) {
    // The prescription header exists with no lines — remove it rather than
    // leave a script a pharmacy could open and find empty. A schedule-limit
    // violation from prescription_items_schedule_limits lands here too, so
    // it's surfaced verbatim rather than flattened into a generic message.
    await supabase.from('prescriptions').delete().eq('id', prescription.id);
    return {
      ok: false as const,
      error: itemsError.message.includes('Schedule')
        ? `${itemsError.message} Lower the repeats or shorten the validity, then issue again.`
        : 'Could not save the medicines. Nothing was issued.',
    };
  }

  await audit({
    actorId: session.id,
    action: 'create',
    entity: 'Prescription',
    entityId: prescription.id,
    subjectId: parsed.data.patientId,
    lawfulBasis: 'provision_of_healthcare',
    metadata: { reference, items: parsed.data.items.length },
  });

  return { ok: true as const, reference };
}

'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireArea, audit } from '@dokta/auth';
import { db } from '@/lib/db';
import { createConsultationRoom } from '@/lib/daily';

const reference = () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 6; i += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  const now = new Date();
  return `APT-${body}-${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export async function loadSlots(doctorId: string, day: string) {
  await requireArea('/patient/appointments');

  const { data, error } = await db().rpc('available_slots', { p_doctor_id: doctorId, p_day: day });
  if (error) return { ok: false as const, error: 'Could not load that day\u2019s slots.' };

  return { ok: true as const, slots: (data as string[]) ?? [] };
}

const schema = z.object({
  doctorId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  type: z.enum(['video', 'in_person', 'home_visit']),
  reasonForVisit: z.string().min(3, 'Tell the doctor why you are booking'),
  symptoms: z.array(z.string()).default([]),
});

export async function bookAppointment(input: unknown) {
  const session = await requireArea('/patient/appointments');
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const supabase = db();
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', session.id)
    .maybeSingle();
  if (!patient) return { ok: false as const, error: 'Complete your profile before booking.' };

  const { data: doctor } = await supabase
    .from('doctors')
    .select('consult_fee, verification, offers_video, users ( full_name )')
    .eq('id', parsed.data.doctorId)
    .maybeSingle();
  if (!doctor || doctor.verification !== 'verified') {
    return { ok: false as const, error: 'This doctor is not accepting bookings.' };
  }
  if (parsed.data.type === 'video' && !doctor.offers_video) {
    return { ok: false as const, error: 'This doctor does not offer video consultations.' };
  }

  const apptReference = reference();
  const scheduledFor = new Date(parsed.data.scheduledFor);

  let roomId: string | null = null;
  if (parsed.data.type === 'video') {
    try {
      const room = await createConsultationRoom(apptReference, scheduledFor);
      roomId = room.url;
    } catch (error) {
      // A video slot with no working room is worse than telling the patient
      // now and letting them pick in-person instead.
      console.error('[booking] Daily room creation failed', error);
      return {
        ok: false as const,
        error: 'Video calling is not available right now. Try an in-person appointment, or try again shortly.',
      };
    }
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      reference: apptReference,
      patient_id: patient.id,
      doctor_id: parsed.data.doctorId,
      type: parsed.data.type,
      scheduled_for: parsed.data.scheduledFor,
      reason_for_visit: parsed.data.reasonForVisit,
      symptoms: parsed.data.symptoms,
      fee: doctor.consult_fee,
      room_id: roomId,
    })
    .select('id')
    .single();

  if (error) {
    // The no_double_booking exclusion constraint is what actually catches a
    // race between two patients booking the same slot at once.
    return {
      ok: false as const,
      error: error.code === '23P01'
        ? 'That slot was just taken. Choose another time.'
        : 'Could not book that appointment. Nothing was charged.',
    };
  }

  await audit({
    actorId: session.id,
    action: 'create',
    entity: 'Appointment',
    entityId: appointment.id,
    subjectId: patient.id,
    lawfulBasis: 'contract',
    metadata: { reference: apptReference, type: parsed.data.type },
  });

  redirect(`/patient/appointments/${appointment.id}/pay`);
}

import { notFound } from 'next/navigation';
import { requireArea, audit } from '@dokta/auth';
import { PageHeader } from '@dokta/ui';
import { db } from '@/lib/db';
import { ConsultationWorkspace } from '@/components/consultation-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Consultation' };

function age(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000);
}

export default async function ConsultationPage({ params }: { params: { id: string } }) {
  const session = await requireArea(`/doctor/consultations/${params.id}`);
  const supabase = db();

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      id, reference, type, status, scheduled_for, reason_for_visit, symptoms, room_id,
      patients (
        id, date_of_birth, gender, allergies, medical_history, chronic_meds, blood_type,
        users ( full_name, phone )
      )
    `)
    .eq('id', params.id)
    .maybeSingle();

  // RLS returns no row at all for an appointment that isn't this doctor's —
  // that looks identical to a bad id, which is the point: no leak either way.
  if (!appointment) notFound();

  const patient = appointment.patients as never as {
    id: string;
    date_of_birth: string | null;
    gender: string;
    allergies: string[];
    medical_history: string[];
    chronic_meds: string[];
    blood_type: string | null;
    users: { full_name: string; phone: string | null };
  };

  await audit({
    actorId: session.id,
    action: 'read',
    entity: 'Consultation',
    entityId: appointment.id,
    subjectId: patient.id,
    lawfulBasis: 'provision_of_healthcare',
  });

  let { data: consultation } = await supabase
    .from('consultations')
    .select('*')
    .eq('appointment_id', appointment.id)
    .maybeSingle();

  if (!consultation) {
    const { data: created } = await supabase
      .from('consultations')
      .insert({ appointment_id: appointment.id })
      .select('*')
      .single();
    consultation = created;
  }

  const [{ data: pastConsultations }, { data: activeScripts }, { data: pharmacies }] = await Promise.all([
    supabase
      .from('consultations')
      .select('id, diagnosis, created_at, appointments ( doctors ( users ( full_name ) ) )')
      .neq('id', consultation!.id)
      .eq('appointments.patient_id', patient.id)
      .not('signed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('prescriptions')
      .select('prescription_items ( medicine_name, strength )')
      .eq('patient_id', patient.id)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('pharmacies').select('id, name, suburb, city').eq('verification', 'verified').order('name'),
  ]);

  const currentMeds = [
    ...(patient.chronic_meds ?? []),
    ...(activeScripts ?? []).flatMap((rx) =>
      (rx.prescription_items as { medicine_name: string; strength: string | null }[]).map(
        (i) => `${i.medicine_name} ${i.strength ?? ''}`.trim(),
      ),
    ),
  ];

  return (
    <>
      <PageHeader title={patient.users.full_name} description={appointment.reference} />
      <ConsultationWorkspace
        appointment={{
          id: appointment.id,
          type: appointment.type,
          status: appointment.status,
          scheduledFor: appointment.scheduled_for,
          reasonForVisit: appointment.reason_for_visit,
          symptoms: appointment.symptoms ?? [],
          roomUrl: appointment.room_id,
        }}
        consultation={{
          id: consultation!.id,
          chiefComplaint: consultation!.chief_complaint,
          notes: consultation!.notes,
          diagnosis: consultation!.diagnosis,
          icd10Codes: consultation!.icd10_codes ?? [],
          followUpDate: consultation!.follow_up_date,
          signedAt: consultation!.signed_at,
        }}
        patient={{
          id: patient.id,
          name: patient.users.full_name,
          phone: patient.users.phone,
          age: age(patient.date_of_birth),
          gender: patient.gender,
          bloodType: patient.blood_type,
          allergies: patient.allergies ?? [],
          history: patient.medical_history ?? [],
          currentMeds: Array.from(new Set(currentMeds)),
        }}
        pastConsultations={(pastConsultations ?? []).map((c) => ({
          id: c.id,
          diagnosis: c.diagnosis,
          date: new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(new Date(c.created_at)),
          doctor: (c.appointments as never as { doctors: { users: { full_name: string } } }).doctors.users
            .full_name,
        }))}
        pharmacies={(pharmacies ?? []).map((p) => ({
          id: p.id,
          label: `${p.name}${p.suburb ? ` — ${p.suburb}` : p.city ? ` — ${p.city}` : ''}`,
        }))}
      />
    </>
  );
}

'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, Pill, Video, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Sheet,
  TextArea,
  SelectField,
} from '@dokta/ui';
import { saveNote, signNote, startConsultation, issuePrescription } from '@/app/doctor/consultations/[id]/actions';

interface Appointment {
  id: string;
  type: string;
  status: string;
  scheduledFor: string;
  reasonForVisit: string | null;
  symptoms: string[];
  roomUrl: string | null;
}

interface ConsultationData {
  id: string;
  chiefComplaint: string | null;
  notes: string | null;
  diagnosis: string | null;
  icd10Codes: string[];
  followUpDate: string | null;
  signedAt: string | null;
}

interface Patient {
  id: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  history: string[];
  currentMeds: string[];
}

export function ConsultationWorkspace({
  appointment,
  consultation,
  patient,
  pastConsultations,
  pharmacies,
}: {
  appointment: Appointment;
  consultation: ConsultationData;
  patient: Patient;
  pastConsultations: { id: string; diagnosis: string | null; date: string; doctor: string }[];
  pharmacies: { id: string; label: string }[];
}) {
  const signed = Boolean(consultation.signedAt);

  const [form, setForm] = React.useState({
    chiefComplaint: consultation.chiefComplaint ?? '',
    notes: consultation.notes ?? '',
    diagnosis: consultation.diagnosis ?? '',
    icd10: consultation.icd10Codes.join(', '),
    followUpDate: consultation.followUpDate ?? '',
  });
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [prescribeOpen, setPrescribeOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Autosave, debounced. A doctor should never lose a note to a closed tab,
  // and should never have to remember to press Save mid-consultation.
  React.useEffect(() => {
    if (signed) return;
    const timeout = setTimeout(() => {
      setSaveState('saving');
      startTransition(async () => {
        const result = await saveNote({
          consultationId: consultation.id,
          chiefComplaint: form.chiefComplaint,
          notes: form.notes,
          diagnosis: form.diagnosis,
          icd10Codes: form.icd10.split(',').map((s) => s.trim()).filter(Boolean),
          followUpDate: form.followUpDate,
        });
        setSaveState(result.ok ? 'saved' : 'error');
        if (!result.ok) setError(result.error);
      });
    }, 1200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, signed]);

  function join() {
    startTransition(async () => {
      await startConsultation(appointment.id);
    });
    if (appointment.roomUrl) window.open(appointment.roomUrl, '_blank', 'noopener,noreferrer');
  }

  function sign() {
    setError(null);
    startTransition(async () => {
      const result = await signNote(consultation.id, appointment.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px] lg:p-8">
      <div className="space-y-5">
        {patient.allergies.length > 0 && (
          <p className="flex items-start gap-2.5 rounded-card border border-alert/30 bg-alert-soft p-4 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
            <span>
              <strong className="font-semibold">Allergic to {patient.allergies.join(', ')}.</strong>{' '}
              Check before prescribing.
            </span>
          </p>
        )}

        {appointment.type === 'video' && appointment.status !== 'completed' && (
          <Card>
            <CardBody className="flex items-center justify-between gap-4 pt-5">
              <div>
                <p className="text-sm font-semibold text-ink">Video consultation</p>
                <p className="text-meta text-muted">
                  {appointment.roomUrl ? 'Opens in a new tab' : 'No room available for this appointment'}
                </p>
              </div>
              <Button onClick={join} disabled={!appointment.roomUrl} loading={pending}>
                <Video className="h-4 w-4" aria-hidden />
                Join call
              </Button>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Consultation note</CardTitle>
            <SaveIndicator state={signed ? 'signed' : saveState} />
          </CardHeader>
          <CardBody className="space-y-4">
            <Field
              label="Chief complaint"
              value={form.chiefComplaint}
              onChange={set('chiefComplaint')}
              disabled={signed}
            />
            <TextArea
              label="Notes"
              rows={6}
              value={form.notes}
              onChange={set('notes')}
              disabled={signed}
              placeholder="Subjective, objective, assessment, plan"
            />
            <Field
              label="Diagnosis"
              value={form.diagnosis}
              onChange={set('diagnosis')}
              disabled={signed}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="ICD-10 codes"
                hint="Comma-separated"
                value={form.icd10}
                onChange={set('icd10')}
                disabled={signed}
              />
              <Field
                label="Follow-up date"
                type="date"
                value={form.followUpDate}
                onChange={set('followUpDate')}
                disabled={signed}
              />
            </div>

            {error && <ErrorState title="Could not save" body={error} />}

            {signed ? (
              <p className="flex items-center gap-2 rounded-control bg-care-soft px-3 py-2.5 text-sm text-care-dark">
                <FileSignature className="h-4 w-4" aria-hidden />
                Signed {new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(consultation.signedAt!))}.
                This note is locked — corrections go in a follow-up consultation.
              </p>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setPrescribeOpen(true)}>
                  <Pill className="h-4 w-4" aria-hidden />
                  Prescribe
                </Button>
                <Button loading={pending} disabled={!form.diagnosis} onClick={sign}>
                  <FileSignature className="h-4 w-4" aria-hidden />
                  Sign and complete
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {pastConsultations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Past consultations</CardTitle>
            </CardHeader>
            <CardBody className="px-0 pb-0">
              <ul className="divide-y divide-hairline border-t border-hairline">
                {pastConsultations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span>
                      <span className="block text-sm text-ink">{c.diagnosis ?? 'No diagnosis recorded'}</span>
                      <span className="block text-meta text-muted">
                        {c.date} · {c.doctor}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      <aside className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Patient</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Row label="Age" value={patient.age != null ? `${patient.age}` : '—'} />
            <Row label="Sex" value={patient.gender} />
            <Row label="Blood type" value={patient.bloodType ?? '—'} />
            <Row label="Phone" value={patient.phone ?? '—'} />
            <div>
              <p className="text-meta text-muted">Chronic conditions</p>
              <p className="mt-0.5 text-ink">
                {patient.history.length ? patient.history.join(', ') : 'None recorded'}
              </p>
            </div>
            <div>
              <p className="text-meta text-muted">Current medication</p>
              <p className="mt-0.5 text-ink">
                {patient.currentMeds.length ? patient.currentMeds.join(', ') : 'None recorded'}
              </p>
            </div>
          </CardBody>
        </Card>

        {appointment.symptoms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Symptoms given at booking</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-1.5">
                {appointment.symptoms.map((s) => (
                  <Badge key={s} tone="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </aside>

      <PrescribeSheet
        open={prescribeOpen}
        onClose={() => setPrescribeOpen(false)}
        consultationId={consultation.id}
        patientId={patient.id}
        pharmacies={pharmacies}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-meta text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' | 'signed' }) {
  if (state === 'signed') return null;
  if (state === 'idle') return null;
  if (state === 'saving') return <span className="text-meta text-muted">Saving…</span>;
  if (state === 'error') return <span className="text-meta text-alert">Not saved</span>;
  return (
    <span className="flex items-center gap-1 text-meta text-care">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      Saved
    </span>
  );
}

interface DraftItem {
  medicineName: string;
  strength: string;
  dosage: string;
  frequency: string;
  quantity: number;
  instructions: string;
}

const BLANK_ITEM: DraftItem = {
  medicineName: '',
  strength: '',
  dosage: '',
  frequency: '',
  quantity: 1,
  instructions: '',
};

function PrescribeSheet({
  open,
  onClose,
  consultationId,
  patientId,
  pharmacies,
}: {
  open: boolean;
  onClose: () => void;
  consultationId: string;
  patientId: string;
  pharmacies: { id: string; label: string }[];
}) {
  const [items, setItems] = React.useState<DraftItem[]>([{ ...BLANK_ITEM }]);
  const [pharmacyId, setPharmacyId] = React.useState('');
  const [repeats, setRepeats] = React.useState('0');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function submit() {
    setError(null);
    const valid = items.filter((i) => i.medicineName && i.dosage && i.frequency);
    if (valid.length === 0) {
      setError('Add at least one complete medicine line.');
      return;
    }

    startTransition(async () => {
      const result = await issuePrescription({
        consultationId,
        patientId,
        pharmacyId: pharmacyId || undefined,
        repeats: Number(repeats),
        notes: notes || undefined,
        items: valid.map((i) => ({
          medicineName: i.medicineName,
          strength: i.strength || undefined,
          dosage: i.dosage,
          frequency: i.frequency,
          quantity: i.quantity,
          instructions: i.instructions || undefined,
        })),
      });

      if (!result.ok) setError(result.error);
      else {
        setDone(result.reference);
        setItems([{ ...BLANK_ITEM }]);
        setNotes('');
      }
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        setDone(null);
        setError(null);
      }}
      title="Prescribe"
      width="lg"
      footer={
        !done && (
          <Button full loading={pending} onClick={submit}>
            Issue prescription
          </Button>
        )
      }
    >
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-care" aria-hidden />
          <p className="mt-3 font-display text-title text-ink">Prescription issued</p>
          <p className="mt-1 text-sm text-muted">{done}</p>
          <Button className="mt-6" variant="outline" onClick={() => setDone(null)}>
            Prescribe another
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="rounded-card border border-hairline p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-meta font-medium text-muted">Medicine {index + 1}</p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    className="text-muted hover:text-alert"
                    aria-label="Remove this medicine"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Medicine"
                  value={item.medicineName}
                  onChange={(e) => updateItem(index, { medicineName: e.target.value })}
                />
                <Field
                  label="Strength"
                  value={item.strength}
                  onChange={(e) => updateItem(index, { strength: e.target.value })}
                />
                <Field
                  label="Dosage"
                  value={item.dosage}
                  onChange={(e) => updateItem(index, { dosage: e.target.value })}
                  placeholder="1 tablet"
                />
                <Field
                  label="Frequency"
                  value={item.frequency}
                  onChange={(e) => updateItem(index, { frequency: e.target.value })}
                  placeholder="Twice daily"
                />
                <Field
                  label="Quantity"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Instructions"
                  hint="Optional"
                  value={item.instructions}
                  onChange={(e) => updateItem(index, { instructions: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => setItems((c) => [...c, { ...BLANK_ITEM }])}>
            Add another medicine
          </Button>

          <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4">
            <SelectField
              label="Repeats"
              value={repeats}
              onChange={(e) => setRepeats(e.target.value)}
              options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              hint="Ignored for Schedule 5/6 medicines"
            />
            <SelectField
              label="Send to pharmacy"
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
              options={[{ value: '', label: 'Let patient choose' }, ...pharmacies.map((p) => ({ value: p.id, label: p.label }))]}
            />
          </div>

          <TextArea label="Note to pharmacist" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Optional" />

          {error && <ErrorState title="Could not issue" body={error} />}
        </div>
      )}
    </Sheet>
  );
}

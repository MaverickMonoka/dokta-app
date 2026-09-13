'use client';

import * as React from 'react';
import Image from 'next/image';
import { Star, Video, MapPin, Search } from 'lucide-react';
import { Button, Card, CardBody, EmptyState, ErrorState, Field, SelectField, Sheet, TextArea, money } from '@dokta/ui';
import { loadSlots, bookAppointment } from '@/app/patient/appointments/book/actions';

interface Doctor {
  id: string;
  name: string;
  avatarUrl: string | null;
  speciality: string;
  languages: string[];
  yearsExperience: number;
  fee: number;
  city: string | null;
  offersVideo: boolean;
  offersInPerson: boolean;
  rating: number;
  ratingCount: number;
  bio: string | null;
}

export function DoctorSearch({ doctors, specialities }: { doctors: Doctor[]; specialities: string[] }) {
  const [speciality, setSpeciality] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Doctor | null>(null);

  const filtered = doctors.filter((d) => {
    if (speciality && d.speciality !== speciality) return false;
    if (query && !`${d.name} ${d.speciality}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <Field
          label="Search"
          hideLabel
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or speciality"
          className="min-w-[220px] flex-1"
        />
        <SelectField
          label="Speciality"
          hideLabel
          value={speciality}
          onChange={(e) => setSpeciality(e.target.value)}
          options={[{ value: '', label: 'All specialities' }, ...specialities.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No doctors match"
          body="Try a different speciality or clear your search."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doctor) => (
            <li key={doctor.id}>
              <Card>
                <CardBody className="pt-5">
                  <div className="flex items-start gap-3">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-navy-100">
                      {doctor.avatarUrl && (
                        <Image src={doctor.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{doctor.name}</p>
                      <p className="truncate text-meta text-muted">{doctor.speciality}</p>
                      {doctor.ratingCount > 0 && (
                        <p className="mt-0.5 flex items-center gap-1 text-meta text-muted">
                          <Star className="h-3 w-3 fill-warn text-warn" aria-hidden />
                          {doctor.rating.toFixed(1)} ({doctor.ratingCount})
                        </p>
                      )}
                    </div>
                  </div>

                  {doctor.bio && <p className="mt-3 line-clamp-2 text-sm text-ink/70">{doctor.bio}</p>}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
                    {doctor.offersVideo && (
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" aria-hidden /> Video
                      </span>
                    )}
                    {doctor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden /> {doctor.city}
                      </span>
                    )}
                    <span>{doctor.languages.slice(0, 2).join(', ')}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="money text-sm font-semibold text-ink">{money(doctor.fee)}</span>
                    <Button size="sm" onClick={() => setSelected(doctor)}>
                      Book
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <BookingSheet doctor={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function BookingSheet({ doctor, onClose }: { doctor: Doctor | null; onClose: () => void }) {
  const [day, setDay] = React.useState('');
  const [slots, setSlots] = React.useState<string[] | null>(null);
  const [slot, setSlot] = React.useState('');
  const [type, setType] = React.useState<'video' | 'in_person'>('video');
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (doctor) {
      const today = new Date();
      today.setDate(today.getDate() + 1); // tomorrow, so slots are never in the past
      setDay(today.toISOString().slice(0, 10));
      setType(doctor.offersVideo ? 'video' : 'in_person');
    } else {
      setDay('');
      setSlots(null);
      setSlot('');
      setReason('');
      setError(null);
    }
  }, [doctor]);

  React.useEffect(() => {
    if (!doctor || !day) return;
    setSlots(null);
    setSlot('');
    startTransition(async () => {
      const result = await loadSlots(doctor.id, day);
      setSlots(result.ok ? result.slots : []);
      if (!result.ok) setError(result.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor, day]);

  function submit() {
    if (!doctor || !slot) return;
    setError(null);
    startTransition(async () => {
      const result = await bookAppointment({
        doctorId: doctor.id,
        scheduledFor: slot,
        type,
        reasonForVisit: reason,
        symptoms: [],
      });
      // A successful booking redirects server-side; only a failure returns here.
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <Sheet
      open={Boolean(doctor)}
      onClose={onClose}
      title={doctor ? `Book ${doctor.name}` : ''}
      description={doctor?.speciality}
      footer={
        doctor && (
          <Button full loading={pending} disabled={!slot || !reason} onClick={submit}>
            Continue to payment
          </Button>
        )
      }
    >
      {doctor && (
        <div className="space-y-4">
          {doctor.offersVideo && doctor.offersInPerson && (
            <SelectField
              label="Consultation type"
              value={type}
              onChange={(e) => setType(e.target.value as 'video' | 'in_person')}
              options={[
                { value: 'video', label: 'Video consultation' },
                { value: 'in_person', label: 'In person' },
              ]}
            />
          )}

          <Field
            label="Date"
            type="date"
            value={day}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDay(e.target.value)}
          />

          {slots !== null && (
            slots.length === 0 ? (
              <p className="text-sm text-muted">No open slots that day. Try another date.</p>
            ) : (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Available times</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={`rounded-control border px-3 py-1.5 text-sm ${
                        slot === s ? 'border-care bg-care-soft text-care-dark' : 'border-hairline text-ink hover:bg-canvas'
                      }`}
                    >
                      {new Date(s).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          <TextArea
            label="Reason for visit"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What would you like to discuss?"
          />

          {error && <ErrorState title="Could not book" body={error} />}
        </div>
      )}
    </Sheet>
  );
}

'use client';

import * as React from 'react';
import { CheckCircle2, Search, UserPlus } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, Field, SelectField } from '@dokta/ui';
import { findPatient, registerWalkIn } from '@/app/clinic/registration/actions';

interface Match {
  id: string;
  name: string;
  phone: string | null;
  idNumber: string | null;
  fileNumber: string | null;
}

export function RegistrationForm({ clinicId }: { clinicId: string | null }) {
  const [query, setQuery] = React.useState('');
  const [matches, setMatches] = React.useState<Match[] | null>(null);
  const [form, setForm] = React.useState({
    fullName: '',
    saIdNumber: '',
    phone: '',
    dateOfBirth: '',
    gender: 'undisclosed',
    reason: '',
    fileNumber: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [ticket, setTicket] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function search() {
    startTransition(async () => {
      const result = await findPatient(query);
      setMatches(result.matches);
    });
  }

  function submit() {
    if (!clinicId) {
      setError('Your account is not linked to a clinic. Ask the manager to add you.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerWalkIn({ clinicId, ...form });
      if (!result.ok) setError(result.error);
      else {
        setTicket(result.ticket);
        setForm({
          fullName: '', saIdNumber: '', phone: '', dateOfBirth: '',
          gender: 'undisclosed', reason: '', fileNumber: '',
        });
        setMatches(null);
        setQuery('');
      }
    });
  }

  if (ticket) {
    return (
      <Card className="max-w-md">
        <CardBody className="pt-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-care" aria-hidden />
          <p className="mt-3 font-display text-title text-ink">Registered</p>
          <p className="mt-1 text-sm text-muted">Give the patient this ticket number.</p>
          <p className="money mt-4 font-display text-[2.5rem] font-bold leading-none text-navy">
            {ticket}
          </p>
          <Button className="mt-6" full onClick={() => setTicket(null)}>
            Register the next patient
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Search first</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            Check by ID number or file number before creating a new record. A duplicate file is how
            a patient loses their history.
          </p>
          <div className="flex items-end gap-2">
            <Field
              label="ID number or file number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" loading={pending} onClick={search}>
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
          </div>

          {matches !== null && (
            matches.length === 0 ? (
              <p className="text-sm text-muted">
                No existing file found. Register them as a new patient.
              </p>
            ) : (
              <ul className="divide-y divide-hairline rounded-card border border-hairline">
                {matches.map((m) => (
                  <li key={m.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-ink">{m.name}</p>
                    <p className="money text-meta text-muted">
                      {m.idNumber ?? m.fileNumber ?? '—'} · {m.phone ?? 'no phone'}
                    </p>
                  </li>
                ))}
              </ul>
            )
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New patient</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Full name" value={form.fullName} onChange={set('fullName')} required />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="ID number"
              hint="Optional"
              value={form.saIdNumber}
              onChange={set('saIdNumber')}
              inputMode="numeric"
            />
            <Field
              label="Mobile"
              hint="Optional"
              value={form.phone}
              onChange={set('phone')}
              inputMode="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={set('dateOfBirth')}
            />
            <SelectField
              label="Sex"
              value={form.gender}
              onChange={set('gender')}
              options={[
                { value: 'undisclosed', label: 'Not stated' },
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
          <Field
            label="Paper file number"
            hint="Optional. Links this record to the physical file."
            value={form.fileNumber}
            onChange={set('fileNumber')}
          />
          <Field
            label="Reason for visit"
            value={form.reason}
            onChange={set('reason')}
            required
          />

          {error && <ErrorState title="Could not register" body={error} />}

          <Button full loading={pending} onClick={submit} disabled={!form.fullName || !form.reason}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Register and issue ticket
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

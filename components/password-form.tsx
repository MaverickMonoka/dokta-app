'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@dokta/auth/client';
import { Button, Field, ErrorState } from '@dokta/ui';

export function PasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true); setError(undefined);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      router.replace('/dashboard'); router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your password. Try again.');
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <Field label="New password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
    <Field label="Confirm password" type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
    {error && <ErrorState title="Password could not be saved" body={error} />}
    <Button type="submit" full loading={busy} disabled={busy || password.length < 8 || confirm.length < 8}>Save password</Button>
  </form>;
}

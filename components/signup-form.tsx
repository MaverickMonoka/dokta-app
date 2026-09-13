'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@dokta/auth/client';
import { Button, ErrorState, Field } from '@dokta/ui';

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [message, setMessage] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    setBusy(true);

    try {
      const supabase = supabaseBrowser();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signupError) throw signupError;

      if (data.session) {
        router.replace('/patient');
        router.refresh();
      } else {
        setMessage('Check your email to confirm your account, then return here to sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      {error && <ErrorState title="Could not create account" body={error} />}
      {message && <p className="rounded-card border border-care/30 bg-care-soft p-4 text-sm text-ink">{message}</p>}
      <Button type="submit" full size="lg" loading={busy} disabled={!fullName || !email || password.length < 8}>Create patient account</Button>
      <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="font-medium text-care hover:text-care-dark">Sign in</Link></p>
    </form>
  );
}

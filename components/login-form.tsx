'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@dokta/auth/client';
import { Button, ErrorState, Field } from '@dokta/ui';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(initialError);
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);

    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (signInError) {
      // Never distinguish "no such account" from "wrong password" — that
      // difference tells an attacker which emails are registered here, which
      // for a health platform is itself sensitive.
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'That email and password do not match an account.'
          : signInError.message,
      );
      return;
    }

    router.replace(next ?? '/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      {error && <ErrorState title="Could not sign in" body={error} />}

      <Button type="submit" full size="lg" loading={busy} disabled={!email || !password}>
        Sign in
      </Button>

      <p className="text-meta text-muted">
        By signing in you agree to how we handle your health information, set out in our{' '}
        <a href="/legal/privacy" className="text-care hover:text-care-dark">
          privacy notice
        </a>
        .
      </p>
    </form>
  );
}

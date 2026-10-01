'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@dokta/auth/client';
import { safeReturnTo } from '@dokta/auth/redirect';
import { Button, ErrorState, Field } from '@dokta/ui';

export function LoginForm({ next, initialError, label = 'Sign in' }: { next?: string; initialError?: string; label?: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(initialError);
  const [busy, setBusy] = React.useState(false);
  const [resetMessage, setResetMessage] = React.useState<string>();

  async function resetPassword() {
    if (!email.trim()) { setError('Enter your email above to request a password reset.'); return; }
    setBusy(true); setError(undefined); setResetMessage(undefined);
    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
        // Route recovery through the server callback so the session cookie is
        // established before the protected password page is opened.
        redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
      });
      if (error) throw error;
      setResetMessage('If this email has an account, a reset link is on its way. Check your inbox and spam folder.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send the reset email. Try again.');
    } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);

    try {
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'That email and password do not match an account.' : signInError.message);
        return;
      }
      router.replace(safeReturnTo(next));
      router.refresh();
    } catch {
      setError('Could not connect. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
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
        {label}
      </Button>

      <button type="button" onClick={resetPassword} disabled={busy} className="text-sm font-medium text-care hover:text-care-dark disabled:opacity-50">
        Forgot password? Send reset link
      </button>
      {resetMessage && <p role="status" className="text-sm text-care">{resetMessage}</p>}

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

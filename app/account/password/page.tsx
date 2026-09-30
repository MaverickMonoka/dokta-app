import Link from 'next/link';
import { requireSession } from '@dokta/auth';
import { PasswordForm } from '@/components/password-form';
export const metadata = { title: 'Set your password' };
export default async function PasswordPage() {
  await requireSession('/account/password');
  return <main id="main" className="mx-auto max-w-md px-6 py-12">
    <Link href="/dashboard" className="text-care hover:underline">Back to dashboard</Link>
    <h1 className="mt-8 font-display text-2xl font-bold text-ink">Set your password</h1>
    <p className="mt-2 text-muted">Choose a password to sign in to your Dokta account again.</p>
    <PasswordForm />
  </main>;
}

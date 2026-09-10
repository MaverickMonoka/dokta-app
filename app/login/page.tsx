import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@dokta/auth';
import { LoginForm } from '@/components/login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const session = await getSession();
  if (session) redirect(searchParams.next ?? homeFor[session.role]);

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      {/* Form first in the DOM so a screen reader and a phone both reach it first. */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="font-display text-xl font-bold tracking-tight text-navy">DOKTA</p>
          <h1 className="mt-8 font-display text-display-2 text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            One account for patients, doctors, pharmacies and clinics. You are taken to your own
            area automatically.
          </p>

          <LoginForm
            next={searchParams.next}
            initialError={
              searchParams.error === 'exchange_failed'
                ? 'That sign-in link has already been used or has expired. Request a new one.'
                : searchParams.error === 'missing_code'
                  ? 'That link was incomplete. Try signing in again.'
                  : undefined
            }
          />
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=70"
          alt="A clinician reviewing notes with a patient"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/70" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-md font-display text-2xl font-bold leading-tight text-white">
            Healthcare records that follow the patient, not the building.
          </p>
        </div>
      </div>
    </main>
  );
}

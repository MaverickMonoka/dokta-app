import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, homeFor, safeReturnTo } from '@dokta/auth';
import { LoginForm } from '@/components/login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; role?: string };
}) {
  const session = await getSession();
  if (session) redirect(safeReturnTo(searchParams.next, homeFor[session.role]));

  const options = [
    { role: 'patient', label: 'Patient Login', description: 'Appointments and health records' },
    { role: 'doctor', label: 'Doctor Login', description: 'Consultations and prescriptions' },
    { role: 'pharmacy', label: 'Pharmacy Login', description: 'Dispensing and pharmacy workspace' },
  ];
  const selected = options.find((option) => option.role === searchParams.role);

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      {/* Form first in the DOM so a screen reader and a phone both reach it first. */}
      <div className="flex items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <p className="font-display text-xl font-bold tracking-tight text-navy">DOKTA</p>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-ink sm:mt-8 sm:text-display-2">{selected?.label ?? 'Sign in to Dokta'}</h1>
          <p className="mt-2 text-sm text-muted">
            Choose your login below, then sign in with your existing account.
          </p>

          <nav aria-label="Login options" className="mt-5 grid gap-2 sm:mt-6">
            {options.map((option) => (
              <Link
                key={option.role}
                href={{ pathname: '/login', query: { role: option.role, ...(searchParams.next ? { next: searchParams.next } : {}) } }}
                aria-current={selected?.role === option.role ? 'page' : undefined}
                className={`rounded-xl border px-4 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-care ${selected?.role === option.role ? 'border-care bg-care/10' : 'border-slate-200 hover:border-care hover:bg-slate-50'}`}
              >
                <span className="block font-semibold text-navy">{option.label}</span>
                <span className="mt-1 block text-xs text-muted">{option.description}</span>
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-muted">
            Your account determines access to your workspace. Clinic staff and administrators can also sign in below.
          </p>

          <LoginForm
            key={selected?.role ?? 'shared'}
            next={searchParams.next}
            label={selected ? `Sign in as ${selected.role === 'pharmacy' ? 'pharmacy staff' : `a ${selected.role}`}` : 'Sign in'}
            initialError={
              searchParams.error === 'exchange_failed'
                ? 'That sign-in link has already been used or has expired. Request a new one.'
                : searchParams.error === 'missing_code'
                  ? 'That link was incomplete. Try signing in again.'
                  : undefined
            }
          />
          <p className="mt-5 text-center text-sm text-muted">
            New to Dokta?{' '}
            <Link href="/signup" className="font-medium text-care hover:text-care-dark">
              Create a patient account
            </Link>
          </p>
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

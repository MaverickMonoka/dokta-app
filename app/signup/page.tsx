import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@dokta/auth';
import { SignupForm } from '@/components/signup-form';

export const metadata = { title: 'Create account' };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(homeFor[session.role]);

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="font-display text-xl font-bold tracking-tight text-navy">DOKTA</p>
          <h1 className="mt-8 font-display text-display-2 text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-muted">Register securely as a patient. Provider and staff access is verified separately.</p>
          <SignupForm />
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Image src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=70" alt="A healthcare professional assisting a patient" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-navy/70" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-md font-display text-2xl font-bold leading-tight text-white">One secure account for appointments, records and medication.</p>
        </div>
      </div>
    </main>
  );
}

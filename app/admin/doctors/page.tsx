import { requireArea } from '@dokta/auth';
import { createDoctor } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string };

export default async function AdminDoctorsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireArea('/admin/doctors');
  if (session.role !== 'admin') return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Doctor onboarding</h1>
      <p className="mt-2 text-sm text-slate-600">Create a practitioner account and send an invitation email.</p>
      {searchParams?.ok ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{searchParams.ok}</p> : null}
      {searchParams?.error ? <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{searchParams.error}</p> : null}
      <form action={createDoctor} className="mt-6 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2">
        <input className="rounded-lg border p-3" name="fullName" placeholder="Full name" required />
        <input className="rounded-lg border p-3" name="email" type="email" placeholder="Email" required />
        <input className="rounded-lg border p-3" name="phone" placeholder="+27821234567" />
        <input className="rounded-lg border p-3" name="speciality" placeholder="Speciality" required />
        <input className="rounded-lg border p-3" name="hpcsaNumber" placeholder="HPCSA number" required />
        <input className="rounded-lg border p-3" name="practiceNumber" placeholder="Practice number" />
        <input className="rounded-lg border p-3" name="yearsExperience" type="number" defaultValue="0" required />
        <input className="rounded-lg border p-3" name="consultFee" type="number" defaultValue="0" required />
        <input className="rounded-lg border p-3" name="followUpFee" type="number" placeholder="Follow-up fee" />
        <input className="rounded-lg border p-3" name="city" placeholder="City" />
        <input className="rounded-lg border p-3" name="province" placeholder="Province" />
        <input className="rounded-lg border p-3" name="languages" defaultValue="English" />
        <label className="text-sm"><input type="checkbox" name="offersVideo" defaultChecked /> Video</label>
        <label className="text-sm"><input type="checkbox" name="offersInPerson" defaultChecked /> In-person</label>
        <button className="rounded-lg bg-emerald-600 p-3 font-semibold text-white sm:col-span-2">Invite doctor</button>
      </form>
    </main>
  );
}

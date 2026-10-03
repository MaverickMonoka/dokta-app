import { requireArea } from '@dokta/auth';
import { createDoctor } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string };

export default async function AdminDoctorsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireArea('/admin/doctors');
  if (session.role !== 'admin') return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-3xl font-bold text-[#061d35]">Doctor onboarding</h1>
      <p className="mt-2 text-sm text-slate-600">Create a practitioner account and send an invitation email.</p>
      {searchParams?.ok ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{searchParams.ok}</p> : null}
      {searchParams?.error ? <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{searchParams.error}</p> : null}
      <form action={createDoctor} className="mt-6 grid gap-3 rounded-[1.5rem] border border-white bg-white p-4 shadow-xl shadow-slate-900/[.05] sm:grid-cols-2 sm:p-6">
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="fullName" placeholder="Full name" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="email" type="email" placeholder="Email" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="phone" placeholder="+27821234567" />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="speciality" placeholder="Speciality" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="hpcsaNumber" placeholder="HPCSA number" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="practiceNumber" placeholder="Practice number" />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="yearsExperience" type="number" defaultValue="0" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="consultFee" type="number" defaultValue="0" required />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="followUpFee" type="number" placeholder="Follow-up fee" />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="city" placeholder="City" />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="province" placeholder="Province" />
        <input className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbfd] p-3 outline-none focus:border-emerald-400" name="languages" defaultValue="English" />
        <label className="text-sm"><input type="checkbox" name="offersVideo" defaultChecked /> Video</label>
        <label className="text-sm"><input type="checkbox" name="offersInPerson" defaultChecked /> In-person</label>
        <button className="min-h-12 rounded-xl bg-[#082f4e] p-3 font-semibold text-white transition hover:bg-[#064e4b] sm:col-span-2">Invite doctor</button>
      </form>
    </main>
  );
}

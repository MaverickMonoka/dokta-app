import { requireArea, supabaseAdmin } from '@dokta/auth';
import { createDoctor } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string };

export default async function AdminDoctorsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireArea('/admin/doctors');
  if (session.role !== 'admin') return null;

  const { data: doctors } = await supabaseAdmin()
    .from('doctors')
    .select('id, speciality, hpcsa_number, consult_fee, verification, city, users(full_name,email)')
    .order('created_at', { ascending: false })
    .limit(25);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Dokta Admin</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">Doctor onboarding</h1>
      <p className="mt-2 text-sm text-slate-600">Invite a practitioner and create a pending Dokta doctor profile.</p>

      {searchParams?.ok ? <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{searchParams.ok}</p> : null}
      {searchParams?.error ? <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{searchParams.error}</p> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form action={createDoctor} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" name="fullName" required />
            <Input label="Email" name="email" type="email" required />
            <Input label="Phone (+27...)" name="phone" />
            <Input label="Speciality" name="speciality" required />
            <Input label="HPCSA number" name="hpcsaNumber" required />
            <Input label="Practice number" name="practiceNumber" />
            <Input label="Years experience" name="yearsExperience" type="number" defaultValue="0" required />
            <Input label="Consult fee (ZAR)" name="consultFee" type="number" defaultValue="0" required />
            <Input label="Follow-up fee" name="followUpFee" type="number" />
            <Input label="City" name="city" />
            <Input label="Province" name="province" />
            <Input label="Languages" name="languages" defaultValue="English" />
          </div>
          <div className="mt-5 flex gap-6 text-sm">
            <label><input type="checkbox" name="offersVideo" defaultChecked /> Video</label>
            <label><input type="checkbox" name="offersInPerson" defaultChecked /> In-person</label>
          </div>
          <button className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">Invite doctor</button>
        </form>

        <section className="rounded-2xl bg-slate-950 p-6 text-white">
          <h2 className="text-xl font-semibold">Recent doctors</h2>
          <div className="mt-4 space-y-3">
            {(doctors ?? []).map((doctor) => {
              const user = doctor.users as never as { full_name: string; email: string } | null;
              return (
                <div key={doctor.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex justify-between gap-4">
                    <div><p className="font-semibold">{user?.full_name ?? 'Doctor'}</p><p className="text-xs text-slate-400">{user?.email}</p></div>
                    <span className="text-xs text-emerald-300">{doctor.verification}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{doctor.speciality} · {doctor.hpcsa_number}</p>
                </div>
              );
            })}
            {!doctors?.length ? <p className="text-sm text-slate-400">No doctors onboarded yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="text-sm text-slate-700">{label}<input {...props} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>;
}

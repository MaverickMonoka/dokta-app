import Link from 'next/link';
import { BookOpen, Calculator, Pill, ExternalLink, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { requireArea } from '@dokta/auth';

const clinicalTools = [
  { title: 'Drug Reference', body: 'Medicine lookup, dosing support, contraindications, interactions and allergy checks.', href: '/doctor/prescriptions', icon: Pill, action: 'Open prescribing' },
  { title: 'Clinical Reference', body: 'Evidence-led condition summaries, investigations and treatment pathways.', href: '#references', icon: BookOpen, action: 'View references' },
  { title: 'Clinical Calculators', body: 'Common validated calculations with formula, source and version shown.', href: '/doctor/clinical/calculators', icon: Calculator, action: 'Open calculators' },
];

const references = [
  ['Epocrates', 'Drug-reference product pattern'],
  ['UpToDate / Lexidrug', 'Evidence and pharmacology reference pattern'],
  ['Medscape', 'Disease, procedure and interaction-reference pattern'],
  ['VisualDx', 'Visual clinical decision-support pattern'],
  ['MDCalc', 'Validated calculator and risk-score pattern'],
];

export default async function ClinicalToolkitPage() {
  await requireArea('/doctor/clinical');
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_85%_0%,rgba(56,189,248,.30),transparent_34%),linear-gradient(145deg,#123f70,#082b50_55%,#061d35)] p-6 text-white shadow-xl md:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-sky-200"><Stethoscope className="h-4 w-4" /> DOKTA Clinical</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Clinical toolkit</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">Fast clinical references and prescribing support inside the doctor workspace. Verify decisions against current South African guidance and medicine information. The National Department of Health STGs/EML are the primary public-sector reference layer.</p>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
          <Search className="h-5 w-5 text-sky-200" />
          <span className="text-sm text-slate-200">Search integration is the next data-provider layer.</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {clinicalTools.map(({ title, body, href, icon: Icon, action }) => (
          <Link key={title} href={href} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg transition hover:-translate-y-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Icon className="h-5 w-5" /></div>
            <h2 className="mt-4 font-bold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            <div className="mt-4 text-sm font-semibold text-sky-700">{action}</div>
          </Link>
        ))}
      </div>

      <section id="calculator-library" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-sky-700" /><h2 className="font-bold text-slate-950">Calculator library</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['BMI', 'eGFR', 'Creatinine clearance', 'Cardiovascular risk'].map((name) => <div key={name} className="rounded-2xl bg-slate-50 p-4"><div className="font-semibold text-slate-900">{name}</div><div className="mt-1 text-xs text-slate-500">Validated implementation required before clinical use</div></div>)}
        </div>
      </section>

      <section id="references" className="rounded-[1.5rem] bg-[#061d35] p-5 text-white shadow-xl">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-300" /><h2 className="font-bold">Reference architecture</h2></div>
        <p className="mt-2 text-sm text-slate-300">These products guide workflow design only. Dokta does not reproduce their proprietary clinical content.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {references.map(([name, use]) => <div key={name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"><div><div className="font-semibold">{name}</div><div className="text-xs text-slate-300">{use}</div></div><ExternalLink className="h-4 w-4 text-sky-300" /></div>)}
        </div>
      </section>
    </div>
  );
}

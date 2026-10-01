import { Calculator } from 'lucide-react';
import { requireArea } from '@dokta/auth';

export default async function CalculatorsPage() {
  await requireArea('/doctor/clinical/calculators');
  const calculators = [
    ['BMI', 'Body mass index'],
    ['eGFR', 'Estimated glomerular filtration rate'],
    ['Creatinine clearance', 'Renal dosing support'],
    ['Cardiovascular risk', 'Risk assessment workflow'],
  ];
  return <div className="space-y-5"><div className="rounded-[2rem] bg-[#061d35] p-6 text-white"><Calculator className="h-6 w-6 text-sky-300" /><h1 className="mt-3 text-3xl font-bold">Clinical calculators</h1><p className="mt-2 text-sm text-slate-300">Calculator shells are intentionally non-computational until validated formulas, populations and source versions are approved.</p></div><div className="grid gap-4 md:grid-cols-2">{calculators.map(([name, desc])=><div key={name} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg"><h2 className="font-bold text-slate-950">{name}</h2><p className="mt-1 text-sm text-slate-600">{desc}</p><div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900">Validation required before clinical use</div></div>)}</div></div>;
}

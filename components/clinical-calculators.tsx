'use client';

import * as React from 'react';

function number(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function bmi(weight: number, heightCm: number) {
  const metres = heightCm / 100;
  return weight / (metres * metres);
}

function egfr2021(creatinineUmol: number, age: number, female: boolean) {
  const scr = creatinineUmol / 88.4;
  const k = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  return 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (female ? 1.012 : 1);
}

function cockcroftGault(creatinineUmol: number, age: number, weightKg: number, female: boolean) {
  const scrMgDl = creatinineUmol / 88.4;
  const result = ((140 - age) * weightKg) / (72 * scrMgDl);
  return female ? result * 0.85 : result;
}

function Input({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<div className="mt-1 flex rounded-xl border border-slate-200 bg-white"><input inputMode="decimal" value={value} onChange={(e)=>onChange(e.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2 outline-none" />{unit && <span className="px-3 py-2 text-slate-500">{unit}</span>}</div></label>;
}

export function ClinicalCalculators() {
  const [weight,setWeight]=React.useState('');
  const [height,setHeight]=React.useState('');
  const [age,setAge]=React.useState('');
  const [creatinine,setCreatinine]=React.useState('');
  const [sex,setSex]=React.useState<'male'|'female'>('male');
  const w=number(weight), h=number(height), a=number(age), cr=number(creatinine);
  const b=w&&h?bmi(w,h):null;
  const e=a&&cr?egfr2021(cr,a,sex==='female'):null;
  const cg=a&&cr&&w?cockcroftGault(cr,a,w,sex==='female'):null;

  return <div className="grid gap-4 lg:grid-cols-3">
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
      <h2 className="font-bold text-slate-950">BMI</h2>
      <p className="mt-1 text-xs text-slate-500">BMI = weight (kg) / height² (m)</p>
      <div className="mt-4 space-y-3"><Input label="Weight" value={weight} onChange={setWeight} unit="kg"/><Input label="Height" value={height} onChange={setHeight} unit="cm"/></div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Result</div><div className="mt-1 text-2xl font-bold text-slate-950">{b?b.toFixed(1):'—'} <span className="text-sm font-normal">kg/m²</span></div></div>
    </section>

    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg lg:col-span-2">
      <h2 className="font-bold text-slate-950">Renal function</h2>
      <p className="mt-1 text-xs text-slate-500">CKD-EPI 2021 eGFR and Cockcroft-Gault creatinine clearance. Creatinine input is µmol/L.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><Input label="Age" value={age} onChange={setAge} unit="years"/><Input label="Serum creatinine" value={creatinine} onChange={setCreatinine} unit="µmol/L"/><Input label="Weight" value={weight} onChange={setWeight} unit="kg"/><label className="block text-sm font-medium text-slate-700">Sex<select value={sex} onChange={(x)=>setSex(x.target.value as 'male'|'female')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"><option value="male">Male</option><option value="female">Female</option></select></label></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">CKD-EPI 2021 eGFR</div><div className="mt-1 text-2xl font-bold">{e?e.toFixed(0):'—'} <span className="text-xs font-normal">mL/min/1.73m²</span></div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Cockcroft-Gault CrCl</div><div className="mt-1 text-2xl font-bold">{cg?cg.toFixed(0):'—'} <span className="text-xs font-normal">mL/min</span></div></div></div>
      <p className="mt-4 text-xs leading-5 text-amber-900">Use the equation appropriate to the clinical purpose and medicine guidance. Cockcroft-Gault can be sensitive to weight selection. Do not use these results as the sole basis for prescribing.</p>
    </section>
  </div>;
}

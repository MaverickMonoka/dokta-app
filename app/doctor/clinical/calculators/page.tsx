import { Calculator } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { ClinicalCalculators } from '@/components/clinical-calculators';

export const metadata = { title: 'Clinical calculators' };

export default async function CalculatorsPage() {
  await requireArea('/doctor/clinical/calculators');
  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] bg-[#061d35] p-6 text-white">
        <Calculator className="h-6 w-6 text-sky-300" />
        <h1 className="mt-3 text-3xl font-bold">Clinical calculators</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Point-of-care calculations with the equation and limitations shown beside each result. Results support clinical judgement and do not replace it.
        </p>
      </div>
      <ClinicalCalculators />
    </div>
  );
}

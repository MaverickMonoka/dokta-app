import { UserPlus } from 'lucide-react';
import { requireArea } from '@dokta/auth';
import { PageHeader } from '@dokta/ui';
import { RegistrationForm } from '@/components/registration-form';
import { db } from '@/lib/db';

export const metadata = { title: 'Registration' };
export const dynamic = 'force-dynamic';

export default async function RegistrationPage() {
  await requireArea('/clinic/registration');

  const { data: clinics } = await db().from('clinics').select('id, name').limit(1);

  return (
    <>
      <PageHeader
        title="Register a patient"
        description="For walk-ins. Search first — a patient who has been here before, or who uses the DOKTA app, already has a file."
      />
      <div className="p-5 lg:p-8">
        <RegistrationForm clinicId={clinics?.[0]?.id ?? null} />
      </div>
    </>
  );
}

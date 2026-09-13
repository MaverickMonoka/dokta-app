import { requireArea } from '@dokta/auth';
import { PageHeader } from '@dokta/ui';
import { db } from '@/lib/db';
import { DoctorSearch } from '@/components/doctor-search';

export const metadata = { title: 'Find a doctor' };
export const dynamic = 'force-dynamic';

export default async function BookAppointment() {
  await requireArea('/patient/appointments');

  // public_doctors is the read-safe view — only verified doctors, only the
  // columns a patient needs to choose one.
  const { data: doctors } = await db()
    .from('public_doctors')
    .select('*')
    .order('rating', { ascending: false });

  const specialities = Array.from(new Set((doctors ?? []).map((d) => d.speciality))).sort();

  return (
    <>
      <PageHeader
        title="Find a doctor"
        description="Filter by speciality, then pick a time. Video consultations open a private room ten minutes before your slot."
      />
      <div className="p-5 lg:p-8">
        <DoctorSearch
          doctors={(doctors ?? []).map((d) => ({
            id: d.id,
            name: d.full_name,
            avatarUrl: d.avatar_url,
            speciality: d.speciality,
            languages: d.languages ?? [],
            yearsExperience: d.years_experience,
            fee: Number(d.consult_fee),
            city: d.city,
            offersVideo: d.offers_video,
            offersInPerson: d.offers_in_person,
            rating: Number(d.rating),
            ratingCount: d.rating_count,
            bio: d.bio,
          }))}
          specialities={specialities}
        />
      </div>
    </>
  );
}

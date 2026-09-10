import { notFound } from 'next/navigation';
import { requireArea } from '@dokta/auth';
import { PageHeader } from '@dokta/ui';
import { db } from '@/lib/db';
import { PaymentCheckout } from '@/components/payment-checkout';

export const metadata = { title: 'Pay for your appointment' };
export const dynamic = 'force-dynamic';

export default async function PayForAppointment({ params }: { params: { id: string } }) {
  await requireArea('/patient/appointments');

  // RLS already limits this to the caller's own appointment; a stranger's id
  // here returns no row rather than someone else's booking.
  const { data: appointment } = await db()
    .from('appointments')
    .select('id, reference, fee, payment_status, scheduled_for, doctors ( users ( full_name ) )')
    .eq('id', params.id)
    .maybeSingle();

  if (!appointment) notFound();

  const doctor = appointment.doctors as never as { users: { full_name: string } };

  return (
    <>
      <PageHeader title="Confirm and pay" description={`Consultation with ${doctor.users.full_name}`} />
      <div className="p-5 lg:p-8">
        <PaymentCheckout
          appointmentId={appointment.id}
          reference={appointment.reference}
          fee={Number(appointment.fee)}
          alreadyPaid={appointment.payment_status === 'succeeded'}
        />
      </div>
    </>
  );
}

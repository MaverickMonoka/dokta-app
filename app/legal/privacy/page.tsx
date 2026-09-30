import Link from 'next/link';

export const metadata = { title: 'Privacy notice' };

export default function PrivacyNotice() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12 text-ink">
      <Link href="/login" className="text-care hover:underline">Back to sign in</Link>
      <p className="mt-8 font-display text-xl font-bold text-navy">DOKTA</p>
      <h1 className="mt-4 font-display text-3xl font-bold">Privacy notice</h1>
      <p className="mt-3 text-sm text-muted">Updated 30 September 2026</p>
      <div className="mt-8 space-y-6 leading-relaxed">
        <section><h2 className="text-xl font-semibold">Information used by Dokta</h2><p className="mt-2">Dokta uses account details, appointments, clinical records, prescriptions and payment references to provide the services you request. Your healthcare provider is responsible for the care they deliver and the records they create.</p></section>
        <section><h2 className="text-xl font-semibold">Who can access information</h2><p className="mt-2">Account roles and database access rules restrict access to records. The platform supports access for patients, treating doctors, relevant clinic and pharmacy staff, and authorised administrators. Access and record changes may be recorded in an audit log.</p></section>
        <section><h2 className="text-xl font-semibold">Service providers</h2><p className="mt-2">Supabase provides account and database services. Stripe, or another payment provider selected at checkout, processes payment information. Dokta stores payment references and statuses rather than your card number. Video appointments, when enabled, use Daily. Hosting and service providers may process information outside South Africa.</p></section>
        <section><h2 className="text-xl font-semibold">Cookies and account security</h2><p className="mt-2">Essential authentication cookies keep you signed in. Sign out when using a shared device. Keep your password private. Sending sensitive medical details through ordinary email is discouraged.</p></section>
        <section><h2 className="text-xl font-semibold">Access, corrections and privacy questions</h2><p className="mt-2">Use your Records area to review available information. Contact the clinic, doctor or pharmacy responsible for your record to request access, a correction, or help with a privacy concern. Ask that provider to refer platform account requests to the Dokta administrator. Deletion requests may be limited where records must be retained for healthcare or other lawful purposes.</p></section>
        <section><h2 className="text-xl font-semibold">Optional services</h2><p className="mt-2">Features such as payment processing and video calling depend on provider configuration and availability. This notice describes the platform; it does not replace your healthcare provider’s privacy notice or consent process.</p></section>
      </div>
    </main>
  );
}

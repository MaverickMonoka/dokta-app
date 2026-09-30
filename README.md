# DOKTA OS

Next.js 14 healthcare application with separate patient, doctor, clinic, pharmacy, and administrator areas. Supabase supplies authentication, PostgreSQL/RLS, and payment/pharmacy Edge Functions.

## Run locally

Use Node 20+ and pnpm 9.12.0:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Configure the Supabase URL and public key in `.env.local`. Privileged keys stay server-side. Never commit credentials. The app and `package.json` are at the repository root; there is no `apps/web` build base directory.

```text
app/                        Next.js routes and server actions
components/                 Forms and role workspaces
packages/auth/              Session, role, audit and safe navigation utilities
packages/ui/                Shared UI and branding
packages/database/          Healthcare schema reference
supabase/migrations/        Versioned database changes
supabase/functions/         checkout, payment-webhook, dispense and reminders
```

## Validate

```sh
pnpm typecheck
pnpm lint
node tests/auth-release.cjs
node tests/edge-security.cjs
pnpm build
```

Deno checks apply to `checkout`, `payment-webhook`, and `dispense`. `tests/database-access.sql` checks own-profile reads, isolation, self-promotion rejection, pharmacy permissions, and administrative updates with every synthetic record rolled back. Run it only after the security/access migrations. No live payment is represented by these regression tests.

## Authentication and data access

Authentication verifies the user against Supabase. Middleware preserves all refreshed cookie chunks, forwards the current path to layouts, closes private routes on auth failures, and sets private/no-store cache headers. Return URLs stay local. Signup routes through `/dashboard`; invited users can set a password at `/account/password`. Sign-out is a server action available on mobile and desktop.

Healthcare tables have forced RLS. Table grants allow authenticated requests to reach the policies; policies determine accessible rows and actions. Care-related profile access follows an established appointment, prescription, or current clinic queue relationship. Pharmacy procedures require caller identity and pharmacy membership, and sales use inventory prices from the database. Service-role keys bypass RLS and require tightly controlled server-side use.

The active database also contains Mobicom Pay tables. Dokta's September 30 security/access migrations target healthcare objects only. Do not reset this shared database. Its historical migration versions differ from this repository's original files: reconcile migration history before using a blanket `supabase db push`.

## Payment configuration

The current patient UI uses embedded Stripe Checkout. The server computes the amount from the stored appointment/order. A return URL does not mark an appointment paid; verified callbacks settle payments.

Set in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (supports the existing publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (administrator onboarding only; server-side)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` and `APP_URL` pointing to the deployed frontend
- `DAILY_API_KEY` if video appointments are enabled

Set as Supabase Edge Function secrets:

- `APP_URL`; `ALLOWED_ORIGINS` for additional exact trusted browser origins
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- For PayFast: `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX`
- Other providers retain their names from `.env.example`; provider-specific sandbox verification is required before enabling them.

PayFast requires a matching merchant, a valid signature, provider-side confirmation, and the stored gateway/amount before settlement. Missing configuration or provider-confirmation outages fail closed. Regression checks use synthetic responses; they do not verify real PayFast account activation.

Register the enabled provider callback at:

```text
https://<project>.supabase.co/functions/v1/payment-webhook/<gateway>
```

For Stripe, enable `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Configure the signing secret for the exact endpoint/environment. Deploy checkout and payment-webhook together. Both checkout and dispense handle trusted-origin preflight requests; the signed-in user's bearer token is still required.

## Release review — 30 September 2026

Confirmed and fixed: missing healthcare table grants, session-cookie loss, unsafe navigation, missing signup destination, absent sign-out controls, missing privacy route, duplicate doctor-profile insertion, absent invited-user password setup, unsigned PayFast callbacks, incorrect payment return path, lack of browser CORS handling, unguarded pharmacy procedures, client-supplied till prices, unscoped monthly reports, and missing server-side slot validation.

The privacy notice describes current platform behaviour; it is not a claim of legal certification. Confirm the operating entity's privacy contact and retention requirements before a public clinical rollout.

External activation still needs a verified administrator account and real licensed doctor profiles/availability. Confirm provider secrets and auth callback allowlists in the dashboards, then test signup, separate dashboards, booking, checkout, webhook replay, and video access in the actual environment. Existing patient data must not be replaced with demo data.

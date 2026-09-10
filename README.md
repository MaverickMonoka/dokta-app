# DOKTA OS

The healthcare operating system for Africa — one Next.js app, four role
areas, and Supabase doing the actual security work instead of the app layer.

This is a from-scratch restructure, not a continuation of the old
`dokta-app.netlify.app` clinic SPA. That app and its live Supabase project
(`MediDesk App`) still exist and still hold real patient data; nothing here
has touched them yet.

---

## What's actually working

| Area | Status |
| --- | --- |
| Schema — 20+ tables, enums, constraints, triggers | Built |
| Row Level Security — every table, deny-by-default | Built |
| POPIA audit log — append-only, no update/delete policy for anyone | Built |
| Patient — appointments, medication, records (with access log) | Built |
| Doctor — appointments, patient list, prescriptions, consultation workspace | Built |
| Clinic — walk-in queue with SATS triage, registration, DoH monthly returns | Built |
| Pharmacy — till (POS), inventory, suppliers, reports | Built |
| Payments — Yoco, PayFast, Ozow, SnapScan behind one checkout function | Built |
| Video consultations — Daily.co room per booking | Built, needs a real API key |
| Booking — real slot picker, double-booking blocked at the database level | Built |
| Seed data | Not written |
| Reminder notifications | Referenced in config, not built |
| Migrating the live MediDesk data into this schema | Not started — see below |

---

## Structure

```
dokta-os/
  apps/web/                   The one Next.js app
    app/
      login/                  Sign-in, redirects by role
      auth/callback/          Supabase auth code exchange
      patient/                appointments, medication, records
      doctor/                 appointments, patients, consultations, prescriptions
      pharmacy/                pos, inventory, suppliers, reports
      clinic/                  queue, registration, government
    components/               Client components — pos terminal, consultation
                               workspace, doctor search, queue board, etc.
    lib/
      db.ts                    Supabase client scoped to the caller's session
      daily.ts                 Video room creation (Daily.co)

  packages/
    database/schema.sql        Source of truth for the schema
    auth/                      Supabase SSR client, session, role routing, audit()
    ui/                        Tailwind preset + component library

  supabase/
    migrations/                 The three files actually applied, in order:
                                 init → rls → functions
    policies/rls.sql            Same RLS content as the migration, kept
                                 separately for review
    functions/                  Edge functions: checkout, dispense, payment-webhook
    config.toml
```

---

## Running it

```bash
git clone <repo> dokta-os && cd dokta-os
pnpm install
cp .env.example .env          # fill in Supabase project values
supabase start                 # local Postgres + auth, via Docker
supabase db push                # applies the three migrations
pnpm dev
```

Open http://localhost:3000. There's no seed data yet (see below), so most
pages will show their empty state until you create accounts and content
through the app itself, or write some rows by hand.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-side only, never exposed to the client
APP_URL

DAILY_API_KEY                    # placeholder — video booking fails clearly until this is real
YOCO_SECRET_KEY / YOCO_WEBHOOK_SECRET
PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE
OZOW_SITE_CODE / OZOW_PRIVATE_KEY / OZOW_API_KEY
SNAPSCAN_MERCHANT_ID / SNAPSCAN_API_KEY
```

Payment and Daily secrets are read by the Supabase edge functions and the
Next.js server, so they're set as **Supabase function secrets**
(`supabase secrets set`) and **Netlify environment variables** respectively —
not committed anywhere.

---

## Architecture notes

**RLS is the real boundary, not the app.** Every table has Row Level Security
enabled and forced. A doctor can only see patients they've actually treated —
enforced by a `treats_patient()` policy predicate at the database level, not
by a query filter in a page component. If a service key ever leaked, someone
querying the database directly would still hit exactly the same walls a
signed-in user does.

**Money and stock moves live in stored procedures, not application code.**
`dispense_prescription`, `ring_up_sale`, and `settle_payment` are Postgres
functions, not Next.js server actions, because they need to be atomic across
several tables — stock deduction, order creation, and prescription status all
succeed together or all roll back together. An edge function or server action
cannot hold a transaction open across multiple round trips; a stored
procedure can.

**Stock comes off first-expiry-first.** `deduct_stock_fefo` skips expired
batches entirely — they can never be sold or dispensed — and fails the whole
operation if unexpired stock can't cover the line.

**Schedule 5/6 prescriptions are enforced twice, on purpose.** The first
trigger checks the prescription header against its medicines. A sandbox test
against a copy of this exact trigger found that it fired *before* any
medicine existed on a new script — the header is always created first, so
the check always saw nothing to flag. A second trigger, on the medicine-item
insert itself, closes that gap regardless of insert order. Worth knowing if
you're touching either trigger.

**Payments are never trusted from the browser.** The `checkout` edge
function computes the amount from the database — the appointment's fee or
the order's total — never from anything the client sends. `payments` has no
client-writable RLS policy at all; the row only ever exists because an edge
function running as the service role created it.

**Video is real but unfinished.** `lib/daily.ts` makes a genuine Daily.co API
call to create a private, time-boxed room at booking time — it's not a stub.
`DAILY_API_KEY` is an empty placeholder, so right now booking a video slot
fails with a clear message instead of handing out a broken link. Once a real
key is set it works with no code change. The call itself is a plain link
that opens Daily's hosted room in a new tab — not embedded in the page.
Embedding their SDK for an in-app call is a separate piece of work.

---

## Deployment (Netlify)

One site, base directory `apps/web`. `netlify.toml` at the repo root has the
build command and security headers already set — `/api/*` and `/patient/*`
are marked `no-store` so health data never sits in a shared cache.

Register these with each payment provider, pointed at your Supabase project:

```
https://<project>.supabase.co/functions/v1/payment-webhook/yoco
https://<project>.supabase.co/functions/v1/payment-webhook/payfast
https://<project>.supabase.co/functions/v1/payment-webhook/ozow
https://<project>.supabase.co/functions/v1/payment-webhook/snapscan
```

---

## Known gaps

- **`pnpm db:seed` will fail right now.** It points at
  `packages/database/seed.sql`, which hasn't been written.
- **`supabase/config.toml` declares a `reminders` function that doesn't
  exist.** `supabase functions deploy` will complain about it until either
  the function is written or the block is removed.
- **Labs, invoicing, messaging, and notification history** exist in the old
  MediDesk schema and have no destination table here yet. Migrating those
  needs schema work first, not just a data transform.
- **Migrating the live MediDesk data is a separate, gated step.** The
  transform logic has been tested against a full synthetic copy of the real
  old schema (see the migration testing notes from that session), but it has
  not been run against the actual 2 patients / 3 appointments in production.
  That happens only with explicit go-ahead, and ideally from a paid Supabase
  branch rather than the free-tier sandbox workaround used for testing.

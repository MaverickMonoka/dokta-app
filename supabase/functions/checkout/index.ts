import { admin, audit, caller, fail, json } from '../_shared/db.ts';
import { reference, round, toCents } from '../_shared/money.ts';

/**
 * Opens a payment for an appointment or an order.
 *
 * This has to run with the service role because payments_admin_only denies
 * every client write on the payments table — the row is only ever created
 * here, after the amount has been computed from the database, never from
 * whatever the browser sends. That is what makes a forged "pay R1" for a
 * R1500 consultation impossible.
 */
Deno.serve(async (request) => {
  if (request.method !== 'POST') return fail('POST only', 405);

  const user = await caller(request);
  if (!user) return fail('Sign in first', 401);

  const { gateway: gatewayId, appointmentId, orderId } = await request.json();
  if (Boolean(appointmentId) === Boolean(orderId)) {
    return fail('Pay for exactly one of an appointment or an order', 400);
  }
  if (!['yoco', 'payfast', 'ozow', 'snapscan'].includes(gatewayId)) {
    return fail('Unknown payment method', 400);
  }

  const db = admin();
  let amount: number;
  let description: string;
  let existingPaymentId: string | null = null;

  if (appointmentId) {
    const { data: appointment } = await db
      .from('appointments')
      .select('id, fee, patient_id, payment_status, doctors ( users ( full_name ) ), patients ( user_id )')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appointment) return fail('Appointment not found', 404);
    if ((appointment.patients as never as { user_id: string }).user_id !== user.id) {
      return fail('That is not your appointment', 403);
    }
    if (appointment.payment_status === 'succeeded') return fail('Already paid', 409);

    amount = Number(appointment.fee);
    const doctor = appointment.doctors as never as { users: { full_name: string } };
    description = `Consultation with ${doctor.users.full_name}`;
  } else {
    const { data: order } = await db
      .from('orders')
      .select('id, total, status, patient_id, pharmacies ( name ), patients ( user_id )')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return fail('Order not found', 404);
    if ((order.patients as never as { user_id: string }).user_id !== user.id) {
      return fail('That is not your order', 403);
    }
    if (order.status !== 'awaiting_payment') return fail('This order is not awaiting payment', 409);

    amount = Number(order.total);
    const pharmacy = order.pharmacies as never as { name: string };
    description = `Medicine from ${pharmacy.name}`;
  }

  // A retry against the same unpaid appointment/order reuses the row rather
  // than piling up abandoned payment attempts.
  const { data: existing } = await db
    .from('payments')
    .select('id, reference, status')
    .match(appointmentId ? { appointment_id: appointmentId } : { order_id: orderId })
    .maybeSingle();

  let paymentReference: string;

  if (existing && existing.status !== 'failed') {
    existingPaymentId = existing.id;
    paymentReference = existing.reference;
  } else {
    paymentReference = reference('PAY');
    const { data: created, error } = await db
      .from('payments')
      .upsert(
        {
          reference: paymentReference,
          user_id: user.id,
          appointment_id: appointmentId ?? null,
          order_id: orderId ?? null,
          amount,
          gateway: gatewayId,
          status: 'processing',
        },
        { onConflict: appointmentId ? 'appointment_id' : 'order_id' },
      )
      .select('id')
      .single();

    if (error) {
      console.error('[checkout] could not create payment row', error);
      return fail('Could not start a payment. Try again.', 500);
    }
    existingPaymentId = created.id;
  }

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
  const target = appointmentId ? `/patient/appointments/${appointmentId}` : `/patient/medication`;

  const request_ = {
    amountCents: toCents(amount),
    reference: paymentReference,
    description,
    successUrl: `${appUrl}${target}?payment=success`,
    cancelUrl: `${appUrl}${target}?payment=cancelled`,
    webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook/${gatewayId}`,
  };

  let checkout;
  try {
    checkout =
      gatewayId === 'yoco'
        ? await createYocoCheckout(request_)
        : gatewayId === 'payfast'
          ? await createPayfastCheckout(request_, user)
          : gatewayId === 'ozow'
            ? await createOzowCheckout(request_, user)
            : createSnapscanCheckout(request_);
  } catch (error) {
    console.error(`[checkout] ${gatewayId} failed`, error);
    return fail('The payment provider could not be reached. Try again.', 502);
  }

  await db.from('payments').update({ gateway_ref: checkout.gatewayRef }).eq('id', existingPaymentId);

  await audit({
    actorId: user.id,
    action: 'create',
    entity: 'Payment',
    entityId: existingPaymentId,
    lawfulBasis: 'contract',
    metadata: { gateway: gatewayId, amount },
  });

  return json({ paymentId: existingPaymentId, reference: paymentReference, ...checkout });
});

interface CheckoutRequest {
  amountCents: number;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

async function createYocoCheckout(r: CheckoutRequest) {
  const response = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('YOCO_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': r.reference,
    },
    body: JSON.stringify({
      amount: r.amountCents,
      currency: 'ZAR',
      successUrl: r.successUrl,
      cancelUrl: r.cancelUrl,
      failureUrl: r.cancelUrl,
      metadata: { reference: r.reference },
    }),
  });
  if (!response.ok) throw new Error(`Yoco ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return { gateway: 'yoco', redirectUrl: data.redirectUrl, gatewayRef: data.id };
}

async function md5(message: string) {
  const { crypto: stdCrypto } = await import('jsr:@std/crypto');
  const bytes = await stdCrypto.subtle.digest('MD5', new TextEncoder().encode(message));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createPayfastCheckout(r: CheckoutRequest, user: { full_name: string; email: string }) {
  const [firstName, ...rest] = user.full_name.split(' ');
  const fields: Record<string, string> = {
    merchant_id: Deno.env.get('PAYFAST_MERCHANT_ID')!,
    merchant_key: Deno.env.get('PAYFAST_MERCHANT_KEY')!,
    return_url: r.successUrl,
    cancel_url: r.cancelUrl,
    notify_url: r.webhookUrl,
    name_first: firstName,
    name_last: rest.join(' ') || firstName,
    email_address: user.email,
    m_payment_id: r.reference,
    amount: (r.amountCents / 100).toFixed(2),
    item_name: r.description.slice(0, 100),
  };

  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
  const body = Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&');
  fields.signature = await md5(passphrase ? `${body}&passphrase=${encodeURIComponent(passphrase)}` : body);

  return {
    gateway: 'payfast',
    redirectUrl:
      Deno.env.get('PAYFAST_SANDBOX') === 'true'
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process',
    gatewayRef: r.reference,
    formFields: fields,
  };
}

async function sha512(message: string) {
  const bytes = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(message));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createOzowCheckout(r: CheckoutRequest, user: { full_name: string }) {
  const siteCode = Deno.env.get('OZOW_SITE_CODE')!;
  const isTest = Deno.env.get('OZOW_TEST_MODE') === 'true';
  const amount = (r.amountCents / 100).toFixed(2);
  const bankRef = r.reference.slice(0, 20);

  const hash = await sha512(
    `${siteCode}ZAZAR${amount}${r.reference}${bankRef}${r.cancelUrl}${r.cancelUrl}${r.successUrl}${r.webhookUrl}${isTest}${Deno.env.get('OZOW_PRIVATE_KEY')}`.toLowerCase(),
  );

  const response = await fetch('https://api.ozow.com/PostPaymentRequest', {
    method: 'POST',
    headers: {
      ApiKey: Deno.env.get('OZOW_API_KEY')!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      SiteCode: siteCode,
      CountryCode: 'ZA',
      CurrencyCode: 'ZAR',
      Amount: amount,
      TransactionReference: r.reference,
      BankReference: bankRef,
      Customer: user.full_name,
      CancelUrl: r.cancelUrl,
      ErrorUrl: r.cancelUrl,
      SuccessUrl: r.successUrl,
      NotifyUrl: r.webhookUrl,
      IsTest: isTest,
      HashCheck: hash,
    }),
  });
  if (!response.ok) throw new Error(`Ozow ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return { gateway: 'ozow', redirectUrl: data.url, gatewayRef: data.paymentRequestId };
}

function createSnapscanCheckout(r: CheckoutRequest) {
  // SnapScan hosts its own payment page behind a QR code; no server call needed to open one.
  const params = new URLSearchParams({
    id: Deno.env.get('SNAPSCAN_MERCHANT_ID')!,
    amount: String(r.amountCents),
    strict: 'true',
    snap_code_reference: r.reference,
  });
  return {
    gateway: 'snapscan',
    redirectUrl: `https://pos.snapscan.io/qr/${Deno.env.get('SNAPSCAN_MERCHANT_ID')}.png?${params}`,
    gatewayRef: r.reference,
  };
}

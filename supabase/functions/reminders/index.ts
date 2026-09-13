import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const expected = Deno.env.get("REMINDERS_SECRET");
  if (!expected) return Response.json({ error: "REMINDERS_SECRET is not configured" }, { status: 503, headers: cors });
  if (req.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return Response.json({ error: "Supabase runtime configuration is missing" }, { status: 503, headers: cors });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const from = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  const { data: appointments, error } = await db
    .from("appointments")
    .select("id, reference, scheduled_for, patient:patients(user_id)")
    .in("status", ["requested", "confirmed"])
    .gte("scheduled_for", from)
    .lt("scheduled_for", to);

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

  let queued = 0;
  for (const appointment of appointments ?? []) {
    const patient = Array.isArray(appointment.patient) ? appointment.patient[0] : appointment.patient;
    const userId = patient?.user_id;
    if (!userId) continue;

    const { data: existing } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("template", "appointment_24h")
      .contains("data", { appointment_id: appointment.id })
      .maybeSingle();

    if (existing) continue;

    const when = new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Johannesburg",
    }).format(new Date(appointment.scheduled_for));

    const { error: insertError } = await db.from("notifications").insert({
      user_id: userId,
      channel: "in_app",
      template: "appointment_24h",
      title: "Appointment reminder",
      body: `Your Dokta appointment ${appointment.reference} is scheduled for ${when}.`,
      data: { appointment_id: appointment.id, scheduled_for: appointment.scheduled_for },
      status: "queued",
    });
    if (!insertError) queued++;
  }

  return Response.json({ ok: true, scanned: appointments?.length ?? 0, queued }, { headers: cors });
});
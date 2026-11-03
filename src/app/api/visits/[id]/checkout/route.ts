import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCareReport, pushLineMessage } from "@/lib/line";
import { buildPromptPayPayload } from "@/lib/promptpay";
import type { CareRecord } from "@/lib/types";

// POST /api/visits/:id/checkout — leave the home, auto-report to family, optionally bill.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lat, lng, amount } = body as {
    lat?: number;
    lng?: number;
    amount?: number;
  };

  const { data: visit } = await supabase
    .from("visits")
    .select("id, patient_id, caregiver_id, status, check_in_at")
    .eq("id", id)
    .single();

  if (!visit) return NextResponse.json({ error: "visit not found" }, { status: 404 });
  if (visit.status !== "checked_in") {
    return NextResponse.json(
      { error: `visit is ${visit.status}, not checked_in` },
      { status: 409 },
    );
  }

  const checkOutAt = new Date().toISOString();

  const { data: closedVisit, error } = await supabase
    .from("visits")
    .update({
      status: "checked_out",
      check_out_at: checkOutAt,
      check_out_lat: lat ?? null,
      check_out_lng: lng ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // ---- Build the family report from the care ledger ----
  const { data: records } = await supabase
    .from("care_records")
    .select("*")
    .eq("visit_id", id)
    .order("seq", { ascending: true });

  const care = (records ?? []) as CareRecord[];
  const vitals: string[] = [];
  const meds: string[] = [];
  const notes: string[] = [];

  for (const r of care) {
    const p = r.payload as Record<string, unknown>;
    if (r.kind === "vital") {
      if (p.systolic) vitals.push(`ความดัน ${p.systolic}/${p.diastolic ?? "-"} mmHg`);
      if (p.pulse) vitals.push(`ชีพจร ${p.pulse} /นาที`);
      if (p.temp) vitals.push(`อุณหภูมิ ${p.temp} °C`);
      if (p.spo2) vitals.push(`ออกซิเจน ${p.spo2}%`);
      if (p.glucose) vitals.push(`น้ำตาล ${p.glucose} mg/dL`);
    } else if (r.kind === "medication") {
      meds.push(`${p.name ?? "ยา"}${p.dose ? ` ${p.dose}` : ""}`);
    } else if (r.kind === "note") {
      notes.push(String(p.text ?? ""));
    }
  }

  // ---- Resolve names via RLS (no service role needed) ----
  const [{ data: patient }, { data: caregiver }] = await Promise.all([
    supabase.from("patients").select("full_name").eq("id", visit.patient_id).single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", visit.caregiver_id ?? "")
      .maybeSingle(),
  ]);

  // ---- Push LINE report to family (needs service role + LINE token) ----
  let deliveredTo: string[] = [];
  const canPushLine =
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);

  if (canPushLine) {
    const admin = createAdminClient();
    const { data: familyLinks } = await admin
      .from("patient_family")
      .select("family_user_id")
      .eq("patient_id", visit.patient_id);

    const familyUserIds = (familyLinks ?? []).map((f) => f.family_user_id);

    if (familyUserIds.length) {
      const { data: familyProfiles } = await admin
        .from("profiles")
        .select("id, line_user_id")
        .in("id", familyUserIds);

      const report = buildCareReport({
        patientName: (patient?.full_name as string) ?? "ผู้สูงอายุ",
        caregiverName: (caregiver?.full_name as string) ?? "ผู้ดูแล",
        checkIn: fmt(visit.check_in_at),
        checkOut: fmt(checkOutAt),
        vitals,
        meds,
        notes,
      });

      for (const fam of familyProfiles ?? []) {
        if (fam.line_user_id) {
          try {
            await pushLineMessage(fam.line_user_id, report);
            deliveredTo.push(fam.line_user_id);
          } catch {
            // Non-fatal: report already persisted; LINE delivery can be retried.
          }
        }
      }
    }
  }

  // ---- Optionally create an invoice (PromptPay) ----
  let invoice: { id: string; promptpay_payload: string } | null = null;
  if (amount != null && amount > 0) {
    const { data: org } = await supabase
      .from("organizations")
      .select("promptpay_receiver_id")
      .eq("id", closedVisit.org_id)
      .single();

    const receiverId = org?.promptpay_receiver_id ?? process.env.PROMPTPAY_RECEIVER_ID;
    let payload: string | null = null;
    if (receiverId) {
      try {
        payload = buildPromptPayPayload(receiverId, amount);
      } catch {
        payload = null;
      }
    }

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        org_id: closedVisit.org_id,
        patient_id: closedVisit.patient_id,
        visit_id: closedVisit.id,
        amount,
        promptpay_payload: payload,
      })
      .select()
      .single();

    if (!invErr && inv) invoice = inv;
  }

  return NextResponse.json({
    visit: closedVisit,
    report_sent_to: deliveredTo.length,
    invoice,
  });
}

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

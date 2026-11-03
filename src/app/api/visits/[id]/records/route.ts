import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCareReport, pushLineMessage } from "@/lib/line";
import { buildPromptPayPayload } from "@/lib/promptpay";
import type { CareRecord } from "@/lib/types";

// POST /api/visits/:id/records — append a care record (hash-chain computed by DB trigger).
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
  const { kind, payload, recorded_at } = body as {
    kind: "vital" | "medication" | "note" | "photo" | "event";
    payload: Record<string, unknown>;
    recorded_at?: string;
  };

  if (!kind || !payload) {
    return NextResponse.json({ error: "kind and payload are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("care_records")
    .insert({
      visit_id: id,
      kind,
      payload,
      recorded_at: recorded_at ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ record: data });
}

// GET /api/visits/:id/records — list the ledger (also returns chain verification status).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("care_records")
    .select("*")
    .eq("visit_id", id)
    .order("seq", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const records = (data ?? []) as CareRecord[];

  // Verify integrity in the DB (same canonical serialization the trigger used).
  const { data: chainValid } = await supabase.rpc("verify_care_chain", {
    p_visit_id: id,
  });

  return NextResponse.json({
    records,
    chain_valid: chainValid ?? false,
  });
}

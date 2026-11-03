import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

// GET /api/invoices/:id/qr — return a PromptPay QR as a PNG data URL.
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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (!invoice) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  if (!invoice.promptpay_payload) {
    return NextResponse.json({ error: "no PromptPay payload on invoice" }, { status: 400 });
  }

  const dataUrl = await QRCode.toDataURL(invoice.promptpay_payload, {
    width: 480,
    margin: 2,
    color: { dark: "#0e4d35", light: "#ffffff" },
  });

  return NextResponse.json({
    invoice_id: invoice.id,
    amount: invoice.amount,
    status: invoice.status,
    qr_data_url: dataUrl,
  });
}

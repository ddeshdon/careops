// LINE Messaging API helpers (push messages, webhook signature check).

import { createHmac } from "crypto";

const LINE_API = "https://api.line.me/v2/bot";

export async function pushLineMessage(to: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");

  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push failed (${res.status}): ${body}`);
  }
}

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("SHA256", secret).update(body).digest("base64");
  return expected === signature;
}

/** Build the human-readable Thai report sent to the family after a visit. */
export function buildCareReport(opts: {
  patientName: string;
  caregiverName: string;
  checkIn: string;
  checkOut: string;
  vitals: string[];
  meds: string[];
  notes: string[];
}): string {
  const lines: string[] = [];
  lines.push(`🏠 รายงานการดูแล — ${opts.patientName}`);
  lines.push(`ผู้ดูแล: ${opts.caregiverName}`);
  lines.push(`เวลา: ${opts.checkIn} – ${opts.checkOut}`);
  if (opts.vitals.length) lines.push(`\n❤️ สัญญาณชีพ\n• ${opts.vitals.join("\n• ")}`);
  if (opts.meds.length) lines.push(`\n💊 ยา\n• ${opts.meds.join("\n• ")}`);
  if (opts.notes.length) lines.push(`\n📝 หมายเหตุ\n• ${opts.notes.join("\n• ")}`);
  lines.push(`\nดูแลโดยระบบ CareOps — อุ่นใจทุกครั้งที่ดูแล`);
  return lines.join("\n");
}

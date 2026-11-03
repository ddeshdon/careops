import { NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line";

// POST /api/line/webhook — LINE Messaging API webhook.
// MVP: verify the signature and ack. Extend to link LINE ids + handle follow events.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const events = JSON.parse(body).events as Array<{
    type: string;
    replyToken?: string;
  }>;

  // MVP: no-op beyond verification. In production, handle:
  //  - 'follow'  → reply with a link code to bind LINE id to a family profile
  //  - 'message' → accept "link <code>" to bind, or forward to caregiver
  void events;

  return NextResponse.json({ ok: true });
}

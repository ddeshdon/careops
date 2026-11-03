"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CareRecord, Invoice, Patient, Visit } from "@/lib/types";

export default function FamilyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: links } = await supabase.from("patient_family").select("patient_id").eq("family_user_id", user.id);
      const ids = (links ?? []).map((l) => l.patient_id);
      if (ids.length === 0) { setLoading(false); return; }

      const [p, v, r, i] = await Promise.all([
        supabase.from("patients").select("*").in("id", ids),
        supabase.from("visits").select("*").in("patient_id", ids).order("scheduled_start", { ascending: false }).limit(20),
        supabase.from("care_records").select("*").in("visit_id", (await supabase.from("visits").select("id").in("patient_id", ids)).data?.map((x) => x.id) ?? []).order("seq", { ascending: false }).limit(30),
        supabase.from("invoices").select("*").in("patient_id", ids).order("created_at", { ascending: false }).limit(10),
      ]);

      setPatients((p.data ?? []) as Patient[]);
      setVisits((v.data ?? []) as Visit[]);
      setRecords((r.data ?? []) as CareRecord[]);
      setInvoices((i.data ?? []) as Invoice[]);
      setLoading(false);
    })();
  }, [router, supabase]);

  async function showQr(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}/qr`);
    if (res.ok) {
      const j = await res.json();
      setQr((prev) => ({ ...prev, [invoiceId]: j.qr_data_url }));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <main className="p-6 text-gray-500">กำลังโหลด…</main>;

  if (patients.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-xl font-bold">ครอบครัว</h1>
        <p className="mt-3 text-gray-500">ยังไม่มีผู้สูงอายุเชื่อมโยงกับบัญชีของคุณ — ติดต่อผู้ประกอบการเพื่อเชื่อม LINE</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">อัพเดตการดูแล</h1>
        <button className="text-sm text-gray-500" onClick={signOut}>ออกจากระบบ</button>
      </header>

      {patients.map((p) => (
        <section key={p.id} className="mb-6">
          <h2 className="font-semibold text-gray-700">👴 {p.full_name}</h2>
          <p className="mb-3 text-xs text-gray-400">
            {visits.filter((v) => v.patient_id === p.id).length} ครั้งล่าสุด
          </p>

          {records
            .filter((r) => visits.some((v) => v.id === r.visit_id && v.patient_id === p.id))
            .slice(0, 8)
            .map((r) => (
              <div key={r.id} className="mb-2 rounded-lg bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{kindLabel(r.kind)}</span>
                  <span className="text-xs text-gray-400">{new Date(r.recorded_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(r.payload, null, 1)}</pre>
              </div>
            ))}
        </section>
      ))}

      {invoices.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">💳 ใบแจ้งหนี้</h2>
          {invoices.map((inv) => (
            <div key={inv.id} className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm">฿{Number(inv.amount).toLocaleString()} — {inv.status}</span>
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => showQr(inv.id)}>
                แสดง QR
              </button>
            </div>
          ))}
          {Object.entries(qr).map(([id, url]) => (
            <img key={id} src={url} alt="PromptPay QR" className="mx-auto mt-4 w-48" />
          ))}
        </section>
      )}
    </main>
  );
}

function kindLabel(k: string) {
  return ({ vital: "❤️ สัญญาณชีพ", medication: "💊 ยา", note: "📝 หมายเหตุ", photo: "📷 รูป", event: "⚡ เหตุการณ์" } as Record<string, string>)[k] ?? k;
}

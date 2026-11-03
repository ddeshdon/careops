"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CareRecord, Visit } from "@/lib/types";

interface GeofenceResult {
  distance_m: number | null;
  within: boolean | null;
}

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<{ invoice?: { id: string } } | null>(null);

  // care log form
  const [vital, setVital] = useState({ systolic: "", diastolic: "", pulse: "", temp: "", spo2: "", glucose: "" });
  const [med, setMed] = useState({ name: "", dose: "" });
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: v } = await supabase.from("visits").select("*").eq("id", params.id).single();
    setVisit(v as Visit);
    await loadRecords();
    setLoading(false);
  }

  async function loadRecords() {
    const res = await fetch(`/api/visits/${params.id}/records`);
    if (res.ok) {
      const j = await res.json();
      setRecords(j.records ?? []);
      setChainValid(j.chain_valid ?? null);
    }
  }

  function getLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => reject(new Error("เปิด Location ไม่ได้ — กรุณาอนุญาตการเข้าถึงตำแหน่ง")),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function checkIn() {
    setBusy(true); setError("");
    try {
      const { lat, lng } = await getLocation();
      const res = await fetch(`/api/visits/${params.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, photoUrl: photo }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "check-in ล้มเหลว");
      setGeofence(j.geofence);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "check-in ล้มเหลว");
    }
    setBusy(false);
  }

  async function checkOut() {
    setBusy(true); setError("");
    try {
      let lat: number | undefined, lng: number | undefined;
      try { ({ lat, lng } = await getLocation()); } catch { /* location optional on checkout */ }
      const res = await fetch(`/api/visits/${params.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, amount: amount ? Number(amount) : undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "check-out ล้มเหลว");
      setResult(j);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "check-out ล้มเหลว");
    }
    setBusy(false);
  }

  async function addRecord(kind: "vital" | "medication" | "note", payload: Record<string, unknown>) {
    const res = await fetch(`/api/visits/${params.id}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    await loadRecords();
  }

  function submitVital(e: React.FormEvent) {
    e.preventDefault();
    const p: Record<string, unknown> = {};
    const num = (s: string) => (s ? Number(s) : undefined);
    if (vital.systolic || vital.diastolic) {
      p.systolic = num(vital.systolic); p.diastolic = num(vital.diastolic);
    }
    if (vital.pulse) p.pulse = num(vital.pulse);
    if (vital.temp) p.temp = num(vital.temp);
    if (vital.spo2) p.spo2 = num(vital.spo2);
    if (vital.glucose) p.glucose = num(vital.glucose);
    if (Object.keys(p).length) addRecord("vital", p);
    setVital({ systolic: "", diastolic: "", pulse: "", temp: "", spo2: "", glucose: "" });
  }

  function submitMed(e: React.FormEvent) {
    e.preventDefault();
    if (!med.name) return;
    addRecord("medication", { name: med.name, dose: med.dose || undefined, given_at: new Date().toISOString() });
    setMed({ name: "", dose: "" });
  }

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    addRecord("note", { text: note.trim(), source: "text" });
    setNote("");
  }

  function startVoice() {
    const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SR) { setError("เบราว์เซอร์นี้ไม่รองรับการพิมพ์ด้วยเสียง"); return; }
    const rec = new SR();
    rec.lang = "th-TH";
    rec.interimResults = false;
    rec.onresult = (e: any) => setNote(e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }

  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => downscale(reader.result as string, 640, (dataUrl) => setPhoto(dataUrl));
    reader.readAsDataURL(file);
  }

  if (loading) return <main className="p-6 text-gray-500">กำลังโหลด…</main>;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => router.push("/caregiver/visits")}>
          ← กลับ
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(visit?.status)}`}>
          {statusLabel(visit?.status)}
        </span>
      </header>

      <h1 className="text-xl font-bold">Visit</h1>
      <p className="text-sm text-gray-500">{new Date(visit?.scheduled_start ?? "").toLocaleString("th-TH")}</p>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Check-in */}
      {visit?.status === "assigned" && (
        <section className="card mt-5">
          <h2 className="font-semibold">1. Check-in เมื่อถึงบ้าน</h2>
          <p className="mt-1 text-xs text-gray-500">บันทึกพิกัด GPS + รูปถ่ายหน้าบ้าน</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
          <button className="btn-secondary mt-3 w-full" onClick={() => fileRef.current?.click()}>
            {photo ? "เปลี่ยนรูปถ่าย ✓" : "ถ่ายรูปหน้าบ้าน"}
          </button>
          {photo && <img src={photo} alt="หน้าบ้าน" className="mt-3 max-h-40 rounded-lg" />}
          <button className="btn-primary mt-3 w-full" disabled={busy} onClick={checkIn}>
            {busy ? "กำลังบันทึก…" : "Check-in (GPS + รูป)"}
          </button>
          {geofence && (
            <p className="mt-2 text-xs text-gray-500">
              ห่างจากบ้าน {geofence.distance_m ?? "-"} ม.
              {geofence.within !== null && (geofence.within ? " ✅ อยู่ในรั้ว" : " ⚠️ นอกระยะ")}
            </p>
          )}
        </section>
      )}

      {/* Care log */}
      {visit?.status === "checked_in" && (
        <section className="mt-5 space-y-4">
          <div className="card">
            <h2 className="font-semibold">2. บันทึกสัญญาณชีพ</h2>
            <form onSubmit={submitVital} className="mt-3 grid grid-cols-3 gap-2">
              <Field label="ตัวบน" value={vital.systolic} set={(s) => setVital({ ...vital, systolic: s })} />
              <Field label="ตัวล่าง" value={vital.diastolic} set={(s) => setVital({ ...vital, diastolic: s })} />
              <Field label="ชีพจร" value={vital.pulse} set={(s) => setVital({ ...vital, pulse: s })} />
              <Field label="อุณหภูมิ" value={vital.temp} set={(s) => setVital({ ...vital, temp: s })} />
              <Field label="ออกซิเจน%" value={vital.spo2} set={(s) => setVital({ ...vital, spo2: s })} />
              <Field label="น้ำตาล" value={vital.glucose} set={(s) => setVital({ ...vital, glucose: s })} />
              <button className="btn-primary col-span-3 mt-1" type="submit">บันทึกสัญญาณชีพ</button>
            </form>
          </div>

          <div className="card">
            <h2 className="font-semibold">3. บันทึกการให้ยา</h2>
            <form onSubmit={submitMed} className="mt-3 space-y-2">
              <input className="input" placeholder="ชื่อยา" value={med.name} onChange={(e) => setMed({ ...med, name: e.target.value })} />
              <input className="input" placeholder="ขนาด (เช่น 1 เม็ด)" value={med.dose} onChange={(e) => setMed({ ...med, dose: e.target.value })} />
              <button className="btn-primary w-full" type="submit">บันทึกยา</button>
            </form>
          </div>

          <div className="card">
            <h2 className="font-semibold">4. หมายเหตุ</h2>
            <form onSubmit={submitNote} className="mt-3 space-y-2">
              <textarea className="input min-h-20" placeholder="บันทึกอาการ / เหตุการณ์" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" type="button" onClick={startVoice}>
                  {listening ? "🎙️ กำลังฟัง…" : "🎙️ พิมพ์ด้วยเสียง"}
                </button>
                <button className="btn-primary flex-1" type="submit">บันทึกหมายเหตุ</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="font-semibold">5. Check-out</h2>
            <input className="input mt-2" type="number" placeholder="ค่าบริการ (บาท, ไม่ต้องใส่ก็ได้)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn-primary mt-3 w-full" disabled={busy} onClick={checkOut}>
              {busy ? "กำลังส่งรายงาน…" : "Check-out + ส่งรายงาน LINE"}
            </button>
            {result && (
              <p className="mt-2 text-sm text-brand-700">
                ✓ ส่งรายงานให้ครอบครัวแล้ว
                {result.invoice && " + ออกใบแจ้งหนี้ PromptPay แล้ว"}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Ledger */}
      <section className="card mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">บันทึกการดูแล ({records.length})</h2>
          <span className={`text-xs ${chainValid === false ? "text-red-600" : "text-gray-400"}`}>
            {chainValid === null ? "" : chainValid ? "🔒 chain ถูกต้อง" : "⚠️ chain ผิดปกติ"}
          </span>
        </div>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">ยังไม่มีบันทึก</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.map((r) => (
              <li key={r.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                <span className="font-medium">{kindLabel(r.kind)}</span>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(r.payload, null, 1)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, set }: { label: string; value: string; set: (s: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input className="input mt-1" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}

function statusLabel(s?: string) {
  return ({ assigned: "รอดำเนินการ", checked_in: "กำลังดูแล", checked_out: "เสร็จสิ้น", completed: "เสร็จสิ้น", cancelled: "ยกเลิก" } as Record<string, string>)[s ?? ""] ?? s;
}
function statusColor(s?: string) {
  return ({ assigned: "bg-amber-100 text-amber-800", checked_in: "bg-brand-100 text-brand-800", checked_out: "bg-gray-100 text-gray-700", completed: "bg-gray-100 text-gray-700", cancelled: "bg-red-100 text-red-700" } as Record<string, string>)[s ?? ""] ?? "bg-gray-100 text-gray-700";
}
function kindLabel(k: string) {
  return ({ vital: "❤️ สัญญาณชีพ", medication: "💊 ยา", note: "📝 หมายเหตุ", photo: "📷 รูป", event: "⚡ เหตุการณ์" } as Record<string, string>)[k] ?? k;
}

function downscale(dataUrl: string, maxW: number, cb: (d: string) => void) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    cb(canvas.toDataURL("image/jpeg", 0.7));
  };
  img.src = dataUrl;
}

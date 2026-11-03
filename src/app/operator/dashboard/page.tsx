"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient, Profile, Visit } from "@/lib/types";

export default function OperatorDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [caregivers, setCaregivers] = useState<Profile[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "new">("list");

  // form
  const [patientId, setPatientId] = useState("");
  const [caregiverId, setCaregiverId] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof?.role !== "operator" && prof?.role !== "admin") {
      router.push(prof?.role === "caregiver" ? "/caregiver/visits" : "/family");
      return;
    }
    setProfile(prof as Profile);
    const orgId = (prof as Profile).org_id!;

    const [p, c, v] = await Promise.all([
      supabase.from("patients").select("*").eq("org_id", orgId).order("full_name"),
      supabase.from("profiles").select("id, full_name").eq("org_id", orgId).eq("role", "caregiver"),
      supabase.from("visits").select("*").eq("org_id", orgId).order("scheduled_start", { ascending: false }).limit(50),
    ]);
    setPatients((p.data ?? []) as Patient[]);
    setCaregivers((c.data ?? []) as Profile[]);
    setVisits((v.data ?? []) as Visit[]);
    setLoading(false);
  }

  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.from("visits").insert({
      org_id: profile!.org_id,
      patient_id: patientId,
      caregiver_id: caregiverId || null,
      scheduled_start: new Date(scheduled).toISOString(),
      status: "assigned",
    });
    if (error) setMsg(`❌ ${error.message}`);
    else {
      setMsg("✓ สร้างงานแล้ว");
      setPatientId(""); setCaregiverId(""); setScheduled("");
      setTab("list");
      load();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <main className="p-6 text-gray-500">กำลังโหลด…</main>;

  const patientName = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "?";
  const caregiverName = (id: string | null) => caregivers.find((c) => c.id === id)?.full_name ?? "ยังไม่มอบหมาย";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard ผู้ประกอบการ</h1>
        <button className="text-sm text-gray-500" onClick={signOut}>ออกจากระบบ</button>
      </header>

      <div className="mb-4 flex gap-2">
        <button className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${tab === "list" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`} onClick={() => setTab("list")}>
          รายการงาน ({visits.length})
        </button>
        <button className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${tab === "new" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`} onClick={() => setTab("new")}>
          + สร้างงานใหม่
        </button>
      </div>

      {tab === "list" ? (
        <ul className="space-y-3">
          {visits.length === 0 && <p className="text-gray-500">ยังไม่มีงาน</p>}
          {visits.map((v) => (
            <li key={v.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{patientName(v.patient_id)}</p>
                  <p className="text-sm text-gray-500">{caregiverName(v.caregiver_id)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(v.scheduled_start ?? "").toLocaleString("th-TH")}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {v.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={createVisit} className="card space-y-3">
          <label className="block">
            <span className="text-sm text-gray-600">ผู้สูงอายุ</span>
            <select className="input mt-1" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">เลือก…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">ผู้ดูแล</span>
            <select className="input mt-1" value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)}>
              <option value="">ยังไม่มอบหมาย</option>
              {caregivers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">เวลานัดหมาย</span>
            <input className="input mt-1" type="datetime-local" required value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </label>
          {msg && <p className="text-sm text-brand-700">{msg}</p>}
          <button className="btn-primary w-full" type="submit">สร้างงาน</button>
        </form>
      )}
    </main>
  );
}

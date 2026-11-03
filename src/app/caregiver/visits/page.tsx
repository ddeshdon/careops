"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Visit } from "@/lib/types";

export default function CaregiverVisitsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("visits")
        .select("*")
        .eq("caregiver_id", user.id)
        .in("status", ["assigned", "checked_in", "checked_out"])
        .order("scheduled_start", { ascending: true });
      setVisits((data ?? []) as Visit[]);
      setLoading(false);
    })();
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <main className="p-6 text-gray-500">กำลังโหลด…</main>;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">งานของฉัน</h1>
        <button className="text-sm text-gray-500" onClick={signOut}>ออกจากระบบ</button>
      </header>

      {visits.length === 0 ? (
        <p className="text-gray-500">ยังไม่มีงานที่ได้รับมอบหมาย</p>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/caregiver/visits/${v.id}`} className="card block">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {new Date(v.scheduled_start ?? "").toLocaleString("th-TH", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    v.status === "checked_in" ? "bg-brand-100 text-brand-800" : v.status === "checked_out" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"
                  }`}>
                    {v.status === "assigned" ? "รอดำเนินการ" : v.status === "checked_in" ? "กำลังดูแล" : "เสร็จสิ้น"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

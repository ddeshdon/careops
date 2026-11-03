import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "operator" || profile?.role === "admin") {
      redirect("/operator/dashboard");
    }
    if (profile?.role === "caregiver") redirect("/caregiver/visits");
    if (profile?.role === "family") redirect("/family");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl">
        🏠
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        CareOps
      </h1>
      <p className="mt-3 max-w-xl text-lg text-gray-600">
        เปลี่ยนทุกครั้งของการดูแล ให้เป็นบันทึกที่ครอบครัว{" "}
        <span className="font-semibold text-brand-700">เห็นได้จริง</span>
      </p>
      <p className="mt-2 max-w-xl text-sm text-gray-500">
        แพลตฟอร์มดูแลผู้สูงอายุที่บ้าน — check-in พร้อมพิกัดและรูปถ่าย, บันทึกสัญญาณชีพ/ยา,
        ส่งรายงานให้ญาติทาง LINE อัตโนมัติ, ใบแจ้งหนี้ PromptPay
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn-primary">
          เข้าสู่ระบบ
        </Link>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          ดูเอกสาร
        </a>
      </div>
      <p className="mt-12 text-xs text-gray-400">
        MVP — proof-of-care ที่เดียวเป็นผลิตภัณฑ์ อย่างอื่นซื้อ ยืม (LINE) หรือทิ้งไว้ก่อน
      </p>
    </main>
  );
}

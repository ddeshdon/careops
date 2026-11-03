import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "CareOps — อุ่นใจทุกครั้งที่ดูแล",
  description:
    "Proof-of-care for Thailand's home-based elderly care. Every visit becomes a verifiable record the family can see.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CareOps" },
};

export const viewport: Viewport = {
  themeColor: "#147a4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

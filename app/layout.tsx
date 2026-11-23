import type { Metadata, Viewport } from "next";
import AuthGate from "./components/auth-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventaris Operasional",
  description: "Pengelolaan stok, pengajuan, QR, dan pembayaran anggota.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><AuthGate>{children}</AuthGate></body></html>;
}

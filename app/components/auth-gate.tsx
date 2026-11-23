"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AccessContext, AppRole } from "./access-context";

type GateState = "checking" | "ready" | "error" | "denied";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-ref") &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "your-publishable-key",
);

const allowedRoutes: Record<AppRole, string[]> = {
  admin: ["*"],
  inventory: ["/", "/data-barang", "/scan", "/mutasi", "/laporan", "/pengajuan"],
  approver: ["/", "/pengajuan", "/mutasi", "/laporan"],
  payroll: ["/", "/pengajuan", "/anggota"],
  member: ["/pengajuan"],
};

export default function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>(supabaseConfigured ? "checking" : "ready");
  const [access, setAccess] = useState<{ role: AppRole; userId: string } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setState("ready");
      return;
    }

    let active = true;
    setState("checking");
    createSupabaseBrowserClient().auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      const isLogin = pathname === "/login";

      if (error) {
        if (isLogin) setState("ready");
        else setState("error");
        return;
      }

      if (!data.user) {
        if (isLogin) {
          setState("ready");
        } else {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
        }
        return;
      }

      if (isLogin) {
        const requestedNext = new URLSearchParams(window.location.search).get("next");
        const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
        if (safeNext === "/") {
          const { data: profile } = await createSupabaseBrowserClient().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
          if (profile?.role === "member") { router.replace("/pengajuan"); return; }
        }
        router.replace(safeNext);
        return;
      }

      const { data: profile, error: profileError } = await createSupabaseBrowserClient().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      if (profileError) { if (active) setState("error"); return; }
      const knownRoles: AppRole[] = ["admin", "inventory", "approver", "payroll", "member"];
      const role = knownRoles.includes(profile?.role as AppRole) ? profile?.role as AppRole : "member";
      if (!allowedRoutes[role]?.some((route) => route === "*" || (route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`)))) {
        if (active) { setAccess({ role, userId: data.user.id }); setState("denied"); }
        return;
      }
      if (active) setAccess({ role, userId: data.user.id });

      setState("ready");
    }).catch(() => {
      if (!active) return;
      if (pathname === "/login") setState("ready");
      else setState("error");
    });

    return () => { active = false; };
  }, [pathname, router]);

  if (state === "checking") {
    return <main className="auth-gate-state"><div className="auth-spinner"/><b>Memeriksa sesi...</b></main>;
  }

  if (state === "denied") return <main className="auth-gate-state"><div className="auth-error-icon">!</div><b>Akses halaman dibatasi</b><p>Peran akun Anda ({access?.role ?? "anggota"}) tidak memiliki izin untuk membuka halaman ini. Hubungi administrator jika akses tersebut diperlukan.</p><a className="primary-button button-link" href={access?.role === "member" ? "/pengajuan" : "/"}>Kembali ke halaman yang diizinkan</a></main>;

  if (state === "error") {
    return <main className="auth-gate-state"><div className="auth-error-icon">!</div><b>Sesi belum dapat diverifikasi</b><p>Periksa koneksi Supabase, lalu coba lagi.</p><button className="primary-button" onClick={() => window.location.reload()}>Coba lagi</button><a href="/login">Kembali ke login</a></main>;
  }

  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

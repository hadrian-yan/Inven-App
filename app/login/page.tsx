"use client";
import Image from "next/image";
import Link from "next/link";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (signInError) throw signInError;

      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tidak bisa masuk. Periksa koneksi dan data akun.");
      setBusy(false);
    }
  }

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-ref") &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "your-publishable-key",
  );

  return <main className="login-shell"><section className="login-card"><Link className="brand login-brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link><div className="eyebrow">AKSES SISTEM</div><h1>Selamat datang</h1><p className="login-subtitle">Masuk untuk mengelola inventaris dan pengajuan anggota.</p>{!supabaseConfigured && <div className="login-setup-note"><b>Cloud belum dikonfigurasi</b><span>Isi URL dan publishable key Supabase di file <code>.env.local</code>, lalu mulai ulang aplikasi.</span></div>}<form onSubmit={signIn} className="login-form"><label className="form-field"><span>Email</span><input type="email" name="email" required autoComplete="username" placeholder="nama@perusahaan.com"/></label><label className="form-field"><span>Kata sandi</span><input type="password" name="password" required autoComplete="current-password" placeholder="Masukkan kata sandi"/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button login-submit" disabled={busy || !supabaseConfigured}>{busy ? "Sedang masuk..." : "Masuk"}</button></form><small className="login-foot">Akun dibuat oleh administrator sistem.</small></section><div className="login-side-note"><span>⌗</span><p>Kelola barang masuk, pengajuan, pembayaran, dan pengembalian dari satu tempat.</p></div></main>;
}

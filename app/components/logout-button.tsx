"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-ref") &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "your-publishable-key",
  );
  if (!configured) return null;

  async function signOut() {
    setBusy(true);
    setErrorMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      window.location.assign("/login");
    } catch {
      setErrorMessage("Keluar gagal. Coba lagi.");
      setBusy(false);
    }
  }

  return <span className="logout-control"><button className="logout-button" onClick={signOut} disabled={busy}>{busy ? "..." : "Keluar"}</button>{errorMessage && <small role="alert">{errorMessage}</small>}</span>;
}

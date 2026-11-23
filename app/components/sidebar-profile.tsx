"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAccess } from "./access-context";
import LogoutButton from "./logout-button";

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  inventory: "Petugas inventaris",
  approver: "Penyetuju pengajuan",
  payroll: "Petugas payroll",
  member: "Anggota",
};

export default function SidebarProfile() {
  const access = useAccess();
  const role = access?.role ?? "admin";
  const roleLabel = roleLabels[role] ?? "Pengguna";
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    async function loadName() {
      if (!access?.userId) return;
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from("profiles").select("full_name").eq("id", access.userId).maybeSingle();
      if (active && data?.full_name?.trim()) setName(data.full_name.trim());
    }
    void loadName();
    return () => { active = false; };
  }, [access?.userId]);

  const displayName = name || (role === "admin" ? "Admin Gudang" : roleLabel);
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="profile"><div className="avatar admin">{initials}</div><div><b>{displayName}</b><small>{roleLabel}</small></div><LogoutButton /></div>;
}

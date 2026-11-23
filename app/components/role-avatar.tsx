"use client";

import { useAccess } from "./access-context";

const initials: Record<string, string> = {
  admin: "AD",
  inventory: "IN",
  approver: "AP",
  payroll: "PY",
  member: "AN",
};

export default function RoleAvatar() {
  const access = useAccess();
  return <div className="avatar admin small-avatar" aria-label={`Peran ${access?.role ?? "pengguna"}`}>{initials[access?.role ?? "admin"] ?? "US"}</div>;
}

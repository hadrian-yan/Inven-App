"use client";

import { createContext, useContext } from "react";

export type AppRole = "admin" | "inventory" | "approver" | "payroll" | "member";
export const AccessContext = createContext<{ role: AppRole; userId: string } | null>(null);
export function useAccess() { return useContext(AccessContext); }

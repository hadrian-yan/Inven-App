"use client";

import { useAccess } from "./access-context";
import LogoutButton from "./logout-button";
import { useState } from "react";

const links = [
  { href: "/", icon: "▦", label: "Ringkasan", roles: ["admin", "inventory", "approver", "payroll"] },
  { href: "/data-barang", icon: "▤", label: "Data barang", roles: ["admin", "inventory"] },
  { href: "/scan", icon: "⌗", label: "Scan QR", roles: ["admin", "inventory"] },
  { href: "/mutasi", icon: "⇄", label: "Mutasi barang", roles: ["admin", "inventory", "approver"] },
  { href: "/anggota", icon: "♙", label: "Anggota", roles: ["admin", "payroll"] },
  { href: "/pengajuan", icon: "▣", label: "Pengajuan & pembayaran", roles: ["admin", "inventory", "approver", "payroll", "member"] },
  { href: "/laporan", icon: "▧", label: "Laporan", roles: ["admin", "inventory", "approver"] },
];

export default function SidebarNav({ active }: { active: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const access = useAccess();
  const role = access?.role ?? "admin";
  const visibleLinks = links.filter((link) => link.roles.includes(role));
  const mobileLinks = role === "admin" ? [...visibleLinks, { href: "/pengaturan", icon: "⚙", label: "Pengaturan", roles: ["admin"] }] : visibleLinks;
  const preferredOrder = [active, "/", "/data-barang", "/scan", "/pengajuan", "/mutasi", "/anggota", "/laporan", "/pengaturan"];
  const orderedMobileLinks = [...mobileLinks].sort((a, b) => preferredOrder.indexOf(a.href) - preferredOrder.indexOf(b.href));
  const primaryMobileLinks = orderedMobileLinks.slice(0, 4);
  const secondaryMobileLinks = orderedMobileLinks.slice(4);
  return <>
    <nav className="desktop-nav" aria-label="Navigasi utama">{visibleLinks.map((link) => <a className={`nav-item${active === link.href ? " active" : ""}`} href={link.href} key={link.href}><span>{link.icon}</span> {link.label}</a>)}</nav>
    <nav className="mobile-nav" aria-label="Navigasi mobile">{primaryMobileLinks.map((link) => <a className={`nav-item${active === link.href ? " active" : ""}`} href={link.href} key={link.href}><span>{link.icon}</span><small>{link.label}</small></a>)}<button className={`nav-item mobile-menu-toggle${menuOpen ? " active" : ""}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span>☰</span><small>Menu</small></button>{menuOpen && <div className="mobile-menu-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><section className="mobile-menu-sheet" aria-label="Menu lainnya"><header><b>Navigasi</b><button onClick={() => setMenuOpen(false)} aria-label="Tutup menu">×</button></header>{secondaryMobileLinks.map((link) => <a href={link.href} key={link.href} onClick={() => setMenuOpen(false)}><span>{link.icon}</span>{link.label}</a>)}<div className="mobile-menu-logout"><LogoutButton /></div></section></div>}</nav>
  </>;
}

export function SettingsNav() {
  const access = useAccess();
  if (access?.role !== "admin") return null;
  return <a className="nav-item" href="/pengaturan"><span>⚙</span> Pengaturan</a>;
}

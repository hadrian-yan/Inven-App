"use client";

import Link from "next/link";
import { useState } from "react";
import { AppRole, useAccess } from "./access-context";
import LogoutButton from "./logout-button";
import NavIcon, { NavIconName } from "./nav-icon";

type NavigationLink = {
  href: string;
  icon: NavIconName;
  label: string;
  mobileLabel: string;
  roles: AppRole[];
};

const links: NavigationLink[] = [
  { href: "/", icon: "dashboard", label: "Ringkasan", mobileLabel: "Ringkasan", roles: ["admin", "inventory", "approver", "payroll"] },
  { href: "/data-barang", icon: "inventory", label: "Data barang", mobileLabel: "Barang", roles: ["admin", "inventory"] },
  { href: "/scan", icon: "scan", label: "Scan QR", mobileLabel: "Scan QR", roles: ["admin", "inventory"] },
  { href: "/pengajuan", icon: "request", label: "Pengajuan & pembayaran", mobileLabel: "Pengajuan", roles: ["admin", "inventory", "approver", "payroll", "member"] },
  { href: "/mutasi", icon: "movement", label: "Mutasi barang", mobileLabel: "Mutasi", roles: ["admin", "inventory", "approver"] },
  { href: "/anggota", icon: "people", label: "Anggota", mobileLabel: "Anggota", roles: ["admin", "payroll"] },
  { href: "/laporan", icon: "report", label: "Laporan", mobileLabel: "Laporan", roles: ["admin", "inventory", "approver"] },
];

const settingsLink: NavigationLink = {
  href: "/pengaturan", icon: "settings", label: "Pengaturan", mobileLabel: "Pengaturan", roles: ["admin"],
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function SidebarNav({ active }: { active: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = useAccess()?.role ?? "admin";
  const visibleLinks = links.filter((link) => link.roles.includes(role));
  const mobileLinks = role === "admin" ? [...visibleLinks, settingsLink] : visibleLinks;
  // Keep item order fixed across routes so the active state never moves the navigation.
  const primaryMobileLinks = mobileLinks.slice(0, 4);
  const secondaryMobileLinks = mobileLinks.slice(4);

  return <>
    <nav className="desktop-nav" aria-label="Navigasi utama">
      {visibleLinks.map((link) => <Link className={`nav-item${isActive(active, link.href) ? " active" : ""}`} aria-current={isActive(active, link.href) ? "page" : undefined} href={link.href} key={link.href}>
        <NavIcon name={link.icon} /><span>{link.label}</span>
      </Link>)}
    </nav>
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      {primaryMobileLinks.map((link) => <Link className={`nav-item${isActive(active, link.href) ? " active" : ""}`} aria-current={isActive(active, link.href) ? "page" : undefined} href={link.href} key={link.href}>
        <NavIcon name={link.icon} /><small>{link.mobileLabel}</small>
      </Link>)}
      <button type="button" className={`nav-item mobile-menu-toggle${menuOpen ? " active" : ""}`} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" onClick={() => setMenuOpen((open) => !open)}>
        <NavIcon name="menu" /><small>Menu</small>
      </button>
      {menuOpen && <div className="mobile-menu-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
        <section className="mobile-menu-sheet" id="mobile-navigation-menu" aria-label="Menu lainnya">
          <header><b>Navigasi</b><button type="button" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">×</button></header>
          {secondaryMobileLinks.map((link) => <Link href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>
            <NavIcon name={link.icon} /><span>{link.label}</span>
          </Link>)}
          <div className="mobile-menu-logout"><LogoutButton /></div>
        </section>
      </div>}
    </nav>
  </>;
}

export function SettingsNav({ active = false }: { active?: boolean }) {
  const access = useAccess();
  if (access?.role !== "admin") return null;
  return <Link className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined} href="/pengaturan"><NavIcon name="settings" /><span>Pengaturan</span></Link>;
}

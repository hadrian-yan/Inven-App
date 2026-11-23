"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";

import { useEffect, useMemo, useState } from "react";
import SidebarProfile from "./components/sidebar-profile";
import RoleAvatar from "./components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DbItem = { id: string; sku: string; name: string; kind: "personal" | "consumable" | "loan"; current_stock: number; minimum_stock: number };
type DbMember = { id: string; full_name: string; job_role: string };
type DbRequest = { id: string; member_id: string; item_id: string; quantity: number; fulfilled_quantity: number; returned_quantity: number; status: "pending" | "approved" | "rejected" | "delivered"; created_at: string };
type DbPayment = { request_id: string; status: "unpaid" | "payroll_scheduled" | "partial" | "paid" };
type Activity = { id: string; name: string; detail: string; time: string; state: string; tone: string };

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Data dashboard tidak dapat dimuat dari Supabase.";
}

export default function Home() {
  const [items, setItems] = useState<DbItem[]>([]);
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [members, setMembers] = useState<DbMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const supabase = createSupabaseBrowserClient();
        const [itemsResult, requestsResult, paymentsResult, membersResult] = await Promise.all([
          supabase.from("items").select("id,sku,name,kind,current_stock,minimum_stock").eq("is_active", true),
          supabase.from("requests").select("id,member_id,item_id,quantity,fulfilled_quantity,returned_quantity,status,created_at").order("created_at", { ascending: false }),
          supabase.from("payments").select("request_id,status"),
          supabase.from("members").select("id,full_name,job_role"),
        ]);
        const failed = [itemsResult, requestsResult, paymentsResult, membersResult].find((result) => result.error);
        if (failed?.error) throw failed.error;
        if (!active) return;
        setItems((itemsResult.data ?? []) as DbItem[]);
        setRequests((requestsResult.data ?? []) as DbRequest[]);
        setPayments((paymentsResult.data ?? []) as DbPayment[]);
        setMembers((membersResult.data ?? []) as DbMember[]);
      } catch (loadError) { if (active) setError(errorText(loadError)); }
      finally { if (active) setLoading(false); }
    }
    void loadDashboard();
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => [
    { label: "Barang tersedia", value: items.reduce((sum, item) => sum + item.current_stock, 0).toLocaleString("id-ID"), note: `${items.length} jenis barang terdaftar`, icon: "▦", tone: "blue" },
    { label: "Menunggu persetujuan", value: requests.filter((request) => request.status === "pending").length.toLocaleString("id-ID"), note: "Pengajuan baru", icon: "◷", tone: "amber" },
    { label: "Pembayaran berjalan", value: payments.filter((payment) => payment.status === "payroll_scheduled" || payment.status === "partial").length.toLocaleString("id-ID"), note: "Cicilan anggota aktif", icon: "Rp", tone: "green" },
    { label: "Stok menipis", value: items.filter((item) => item.current_stock <= item.minimum_stock).length.toLocaleString("id-ID"), note: "Di bawah batas minimum", icon: "!", tone: "red" },
    { label: 'Pinjaman terbuka', value: requests.filter((request) => { const item = items.find((entry) => entry.id === request.item_id); return item?.kind === 'loan' && request.fulfilled_quantity > request.returned_quantity; }).length.toLocaleString('id-ID'), note: 'Transaksi menunggu kembali', icon: '↙', tone: 'amber' },
  ], [items, requests, payments]);

  const activities = useMemo<Activity[]>(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    return requests.slice(0, 4).map((request) => {
      const member = memberById.get(request.member_id);
      const item = itemById.get(request.item_id);
      const status = request.status === "pending" ? { label: "Menunggu", tone: "pending" }
        : request.status === "approved" ? { label: "Disetujui", tone: "done" }
        : request.status === "delivered" ? { label: "Diserahkan", tone: "returned" }
        : { label: "Ditolak", tone: "paid" };
      const date = new Date(request.created_at);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const dayLabel = date.toDateString() === now.toDateString() ? "Hari ini" : date.toDateString() === yesterday.toDateString() ? "Kemarin" : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      return { id: request.id, name: member?.full_name ?? "Anggota", detail: `${item?.name ?? "Barang"} · ${member?.job_role ?? "Lainnya"} · ${request.quantity} unit`, time: `${dayLabel}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, state: status.label, tone: status.tone };
    });
  }, [items, members, requests]);

  const lowStockItems = useMemo(() => items.filter((item) => item.current_stock <= item.minimum_stock).sort((a, b) => a.current_stock - b.current_stock).slice(0, 5), [items]);
  const openLoans = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    return requests.filter((request) => {
      const item = itemById.get(request.item_id);
      return item?.kind === "loan" && request.fulfilled_quantity > request.returned_quantity;
    }).slice(0, 5).map((request) => ({ request, item: itemById.get(request.item_id), member: memberById.get(request.member_id) }));
  }, [items, members, requests]);
  const notifications = useMemo(() => [
    { label: "Pengajuan menunggu persetujuan", count: requests.filter((request) => request.status === "pending").length, href: "/pengajuan", detail: "Perlu ditinjau admin" },
    { label: "Barang mencapai batas minimum", count: items.filter((item) => item.current_stock <= item.minimum_stock).length, href: "/data-barang", detail: "Periksa dan tambah stok" },
    { label: "Pinjaman belum kembali", count: openLoans.length, href: "/scan", detail: "Proses pengembalian barang" },
    { label: "Pembayaran potong gaji berjalan", count: payments.filter((payment) => payment.status === "payroll_scheduled" || payment.status === "partial").length, href: "/pengajuan", detail: "Pantau cicilan anggota" },
  ], [requests, items, openLoans, payments]);
  const notificationCount = notifications.reduce((sum, entry) => sum + entry.count, 0);
  const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link>
        <div className="workspace-label">WORKSPACE</div>
        <SidebarNav active="/" />
        <div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Ringkasan</b></div><div className="top-actions"><div className="notification-area"><button className="icon-button" aria-label="Notifikasi" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{notificationCount > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-title"><b>Notifikasi operasional</b><button aria-label="Tutup notifikasi" onClick={() => setNotificationsOpen(false)}>×</button></div>{loading ? <p className="notification-empty">Memuat ringkasan…</p> : notifications.map((entry) => <a className="notification-row" href={entry.href} key={entry.label} onClick={() => setNotificationsOpen(false)}><span className={entry.count ? "notification-count active" : "notification-count"}>{entry.count}</span><span><b>{entry.label}</b><small>{entry.count ? entry.detail : "Tidak ada yang perlu ditindaklanjuti"}</small></span><span className="notification-arrow">→</span></a>)}</div>}</div><div className="top-divider"/><RoleAvatar /></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">{today.toLocaleUpperCase("id-ID")}</div><h1>Ringkasan inventaris <span>✦</span></h1><p>Ringkasan stok dan aktivitas inventaris dari Supabase.</p></div><a className="primary-button button-link" href="/data-barang"><span>＋</span> Catat barang masuk</a></div>

          {error && <div className="success-notice error-notice" role="alert"><span>!</span>{error}</div>}
          <div className="stat-grid">{stats.map((item) => <article className="stat-card" key={item.label}><div className="stat-top"><span>{item.label}</span><span className={`stat-icon ${item.tone}`}>{item.icon}</span></div><div className="stat-value">{loading ? "—" : item.value}</div><div className="stat-note">{item.note}</div></article>)}</div>

          <div className="section-heading"><div><h2>Pengajuan terbaru</h2><p>Aktivitas pengajuan anggota dari Supabase</p></div><a className="text-button" href="/pengajuan">Lihat semua <span>→</span></a></div>
          <section className="activity-card"><div className="table-head"><span>ANGGOTA / AKTIVITAS</span><span>WAKTU</span><span>STATUS</span></div>{loading ? <div className="history-empty">Memuat aktivitas…</div> : activities.length === 0 ? <div className="history-empty">Belum ada aktivitas. Buat pengajuan untuk mulai menggunakan alur inventaris.</div> : activities.map((activity) => <div className="activity-row" key={activity.id}><div className="person-cell"><div className="avatar">{activity.name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</div><div><b>{activity.name}</b><small>{activity.detail}</small></div></div><span className="time">{activity.time}</span><span className={`pill ${activity.tone}`}><i />{activity.state}</span></div>)}</section>

                    <div className="dashboard-queues"><section className="queue-card"><div className="queue-heading"><div><h2>Stok perlu ditambah</h2><p>Barang pada atau di bawah batas minimum</p></div><a href="/data-barang">Data barang →</a></div>{loading ? <div className="queue-empty">Memuat stok…</div> : lowStockItems.length === 0 ? <div className="queue-empty">Semua stok berada di atas batas minimum.</div> : lowStockItems.map((item) => <div className="queue-row" key={item.id}><div><b>{item.name}</b><small>{item.sku} · minimum {item.minimum_stock}</small></div><span className="queue-stock">{item.current_stock} tersisa</span></div>)}</section><section className="queue-card"><div className="queue-heading"><div><h2>Pinjaman belum kembali</h2><p>Transaksi barang yang masih di anggota</p></div><a href="/scan">Proses pengembalian →</a></div>{loading ? <div className="queue-empty">Memuat pinjaman…</div> : openLoans.length === 0 ? <div className="queue-empty">Tidak ada pinjaman yang menunggu pengembalian.</div> : openLoans.map(({ request, item, member }) => <div className="queue-row" key={request.id}><div><b>{item?.name ?? "Barang"}</b><small>{member?.full_name ?? "Anggota"} · {member?.job_role ?? "Lainnya"}</small></div><span className="queue-stock loan-quantity">{request.fulfilled_quantity - request.returned_quantity} belum kembali</span></div>)}</section></div>
          <div className="lower-grid"><section className="info-card"><div className="info-icon scan">⌗</div><div><h3>Mulai dengan scan QR</h3><p>Pindai barang untuk melihat detail, mencatat barang keluar, atau memproses pengembalian.</p><a className="outline-button button-link" href="/scan">Buka pemindai <span>→</span></a></div></section></div>
          <footer>Inventaris Operasional <span>·</span> Ringkasan dari Supabase</footer>
        </div>
      </section>
    </main>
  );
}

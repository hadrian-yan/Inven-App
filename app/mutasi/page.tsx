"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";
import { useEffect, useMemo, useState } from "react";
import SidebarProfile from "../components/sidebar-profile";
import RoleAvatar from "../components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
type Movement = { id: string; item_id: string; request_id: string | null; movement: "inbound" | "outbound" | "return"; quantity: number; note: string | null; created_at: string };
type Item = { id: string; sku: string; name: string; variant: string; unit: string };
type RequestRow = { id: string; request_no: string; member_id: string };
type Member = { id: string; full_name: string; job_role: string };
type Row = Movement & { itemName: string; sku: string; unit: string; requestNo: string; memberName: string; role: string };
const movementLabel = { inbound: "Barang masuk", outbound: "Barang keluar", return: "Pengembalian" };
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
export default function MutasiPage() {
  const [rows, setRows] = useState<Row[]>([]); const [filter, setFilter] = useState("Semua"); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const [movementResult, itemResult, requestResult, memberResult] = await Promise.all([
        supabase.from("stock_movements").select("id,item_id,request_id,movement,quantity,note,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("items").select("id,sku,name,variant,unit"), supabase.from("requests").select("id,request_no,member_id"), supabase.from("members").select("id,full_name,job_role"),
      ]);
      const failed = [movementResult, itemResult, requestResult, memberResult].find((result) => result.error); if (failed?.error) throw failed.error;
      const items = new Map(((itemResult.data ?? []) as Item[]).map((row) => [row.id, row]));
      const requests = new Map(((requestResult.data ?? []) as RequestRow[]).map((row) => [row.id, row]));
      const members = new Map(((memberResult.data ?? []) as Member[]).map((row) => [row.id, row]));
      setRows(((movementResult.data ?? []) as Movement[]).map((row) => { const item = items.get(row.item_id); const request = row.request_id ? requests.get(row.request_id) : undefined; const member = request ? members.get(request.member_id) : undefined; return { ...row, itemName: item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang", sku: item?.sku ?? "—", unit: item?.unit ?? "unit", requestNo: request?.request_no ?? "—", memberName: member?.full_name ?? "—", role: member?.job_role ?? "" }; }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat riwayat mutasi."); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => rows.filter((row) => { const matchesType = filter === "Semua" || movementLabel[row.movement] === filter; const term = query.trim().toLowerCase(); return matchesType && (!term || `${row.itemName} ${row.sku} ${row.memberName} ${row.requestNo} ${row.note ?? ""}`.toLowerCase().includes(term)); }), [rows, filter, query]);
  const inbound = rows.filter((row) => row.movement === "inbound").length; const outbound = rows.filter((row) => row.movement === "outbound").length; const returned = rows.filter((row) => row.movement === "return").length;
  return <main className="shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link><div className="workspace-label">WORKSPACE</div><SidebarNav active="/mutasi" /><div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div></aside>
    <section className="main-panel"><header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Mutasi barang</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><div className="top-divider"/><RoleAvatar /></div></header>
      <div className="content inventory-content"><div className="page-heading"><div><div className="eyebrow">RIWAYAT PERGERAKAN STOK</div><h1>Mutasi barang</h1><p>Riwayat barang masuk, penyerahan kepada anggota, dan pengembalian.</p></div><button className="outline-button" onClick={() => void load()} disabled={loading}>↻ Muat ulang</button></div>
        <div className="inventory-summary"><article><span>Total transaksi</span><b>{rows.length}</b><small>Mutasi tersimpan di Supabase</small></article><article><span>Barang masuk</span><b>{inbound}</b><small>Transaksi penerimaan</small></article><article><span>Barang keluar</span><b>{outbound}</b><small>Transaksi penyerahan</small></article><article><span>Pengembalian</span><b>{returned}</b><small>Transaksi pengembalian</small></article></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <section className="inventory-card"><div className="inventory-toolbar"><div><h2>Riwayat mutasi</h2><p>Menampilkan hingga 500 transaksi terbaru</p></div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari barang, anggota, atau nomor..." aria-label="Cari mutasi" /></label></div><div className="category-tabs">{["Semua", "Barang masuk", "Barang keluar", "Pengembalian"].map((label) => <button key={label} className={filter === label ? "category-tab selected" : "category-tab"} onClick={() => setFilter(label)}>{label}</button>)}</div>
          <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>WAKTU</th><th>JENIS TRANSAKSI</th><th>BARANG</th><th>ANGGOTA</th><th>NO. PENGAJUAN</th><th>JUMLAH</th><th>CATATAN</th></tr></thead><tbody>{!loading && filtered.map((row) => <tr key={row.id}><td>{dateFormat.format(new Date(row.created_at))}</td><td><span className="category-chip">{movementLabel[row.movement]}</span></td><td><div className="item-name"><span className="item-symbol">▤</span><span><b>{row.itemName}</b><small>{row.sku}</small></span></div></td><td>{row.memberName}{row.role && <small style={{ display: "block", color: "#9aa7ae" }}>{row.role}</small>}</td><td>{row.requestNo}</td><td><b>{row.quantity} {row.unit}</b></td><td>{row.note || "—"}</td></tr>)}</tbody></table>{loading && <div className="empty-state"><b>Memuat riwayat mutasi…</b></div>}{!loading && filtered.length === 0 && <div className="empty-state"><span>⇄</span><b>{rows.length ? "Mutasi tidak ditemukan" : "Belum ada riwayat mutasi"}</b><p>Transaksi masuk, keluar, dan kembali akan tercatat di sini.</p></div>}</div><div className="table-foot">Menampilkan <b>{filtered.length}</b> dari <b>{rows.length}</b> transaksi<span>↻ Diperbarui langsung dari Supabase</span></div></section>
      </div>
    </section>
  </main>;
}

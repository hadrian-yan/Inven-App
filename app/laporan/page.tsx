"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";
import { useEffect, useMemo, useState } from "react";
import SidebarProfile from "../components/sidebar-profile";
import RoleAvatar from "../components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
type Item = { id: string; sku: string; name: string; variant: string; category: string; unit: string; current_stock: number; minimum_stock: number; unit_price: number };
type Movement = { id: string; item_id: string; request_id: string | null; movement: "inbound" | "outbound" | "return"; quantity: number; note: string | null; created_at: string };
type RequestRow = { id: string; request_no: string; item_id: string; quantity: number; fulfilled_quantity: number; returned_quantity: number; status: string; total_amount: number; created_at: string };
type Payment = { id: string; request_id: string; status: "unpaid" | "payroll_scheduled" | "partial" | "paid"; total_amount: number };
type Installment = { payment_id: string; amount: number; status: "scheduled" | "recorded"; recorded_at: string | null };
type ReportData = { items: Item[]; movements: Movement[]; requests: RequestRow[]; payments: Payment[]; installments: Installment[] };
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const labels: Record<Movement["movement"], string> = { inbound: "Masuk", outbound: "Keluar", return: "Kembali" };
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
function downloadCsv(rows: (string | number)[][], filename: string) { const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n"); const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
export default function LaporanPage() {
  const [data, setData] = useState<ReportData>({ items: [], movements: [], requests: [], payments: [], installments: [] }); const [period, setPeriod] = useState(30); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const db = createSupabaseBrowserClient(); const results = await Promise.all([
    db.from("items").select("id,sku,name,variant,category,unit,current_stock,minimum_stock,unit_price").eq("is_active", true).order("name"),
    db.from("stock_movements").select("id,item_id,request_id,movement,quantity,note,created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("requests").select("id,request_no,item_id,quantity,fulfilled_quantity,returned_quantity,status,total_amount,created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("payments").select("id,request_id,status,total_amount"),
    db.from("payment_installments").select("payment_id,amount,status,recorded_at"),
  ]); const failed = results.find((result) => result.error); if (failed?.error) throw failed.error; setData({ items: (results[0].data ?? []) as Item[], movements: (results[1].data ?? []) as Movement[], requests: (results[2].data ?? []) as RequestRow[], payments: (results[3].data ?? []) as Payment[], installments: (results[4].data ?? []) as Installment[] }); } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat laporan."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const since = useMemo(() => new Date(Date.now() - period * 86400000), [period]);
  const movements = useMemo(() => data.movements.filter((row) => new Date(row.created_at) >= since), [data.movements, since]);
  const requests = useMemo(() => data.requests.filter((row) => new Date(row.created_at) >= since), [data.requests, since]);
  const stockValue = data.items.reduce((sum, item) => sum + item.current_stock * Number(item.unit_price), 0);
  const inbound = movements.filter((row) => row.movement === "inbound").reduce((sum, row) => sum + row.quantity, 0);
  const outbound = movements.filter((row) => row.movement === "outbound").reduce((sum, row) => sum + row.quantity, 0);
  const returned = movements.filter((row) => row.movement === "return").reduce((sum, row) => sum + row.quantity, 0);
  const paymentById = new Map(data.payments.map((payment) => [payment.id, payment]));
  const recordedPayroll = data.installments.filter((part) => part.status === "recorded" && paymentById.get(part.payment_id)?.status !== "paid").reduce((sum, part) => sum + Number(part.amount), 0);
  const paid = data.payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.total_amount), 0) + recordedPayroll;
  const billed = data.payments.reduce((sum, payment) => sum + Number(payment.total_amount), 0);
  const outstanding = Math.max(0, billed - paid);
  const lowStock = data.items.filter((item) => item.current_stock <= item.minimum_stock);
  const itemById = new Map(data.items.map((item) => [item.id, item]));
  const reportMovements = movements.slice(0, 100);
  const exportReport = () => { const rows: (string | number)[][] = [["Tanggal", "Jenis", "SKU", "Barang", "Jumlah", "Anggota/pengajuan", "Catatan"], ...reportMovements.map((row) => { const item = itemById.get(row.item_id); const request = row.request_id ? data.requests.find((r) => r.id === row.request_id) : undefined; return [new Date(row.created_at).toLocaleString("id-ID"), labels[row.movement], item?.sku ?? "", item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang", row.quantity, request?.request_no ?? "", row.note ?? ""]; })]; downloadCsv(rows, `laporan-inventaris-${period}-hari.csv`); };
  return <main className="shell"><aside className="sidebar"><Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link><div className="workspace-label">WORKSPACE</div><SidebarNav active="/laporan" /><div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div></aside>
    <section className="main-panel"><header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Laporan</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><div className="top-divider"/><RoleAvatar /></div></header>
      <div className="content inventory-content"><div className="page-heading"><div><div className="eyebrow">ANALISIS INVENTARIS</div><h1>Laporan</h1><p>Ringkasan stok, mutasi barang, dan pembayaran anggota.</p></div><div className="page-heading-actions"><select className="period-select" value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={7}>7 hari</option><option value={30}>30 hari</option><option value={90}>90 hari</option></select><button className="outline-button" onClick={() => void load()} disabled={loading}>↻ Muat ulang</button><button className="primary-button" onClick={exportReport} disabled={loading}>↓ Ekspor CSV</button></div></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="inventory-summary"><article><span>Jenis barang aktif</span><b>{data.items.length}</b><small>Nilai stok {money.format(stockValue)}</small></article><article><span>Stok rendah</span><b className={lowStock.length ? "low-number" : ""}>{lowStock.length}</b><small>Sudah mencapai batas minimum</small></article><article><span>Barang masuk ({period} hari)</span><b>{inbound}</b><small>Jumlah unit diterima</small></article><article><span>Keluar / kembali ({period} hari)</span><b>{outbound} / {returned}</b><small>Jumlah unit dalam periode</small></article></div>
        <div className="inventory-summary"><article><span>Pembayaran lunas</span><b>{money.format(paid)}</b><small>Nilai total pembayaran berstatus lunas</small></article><article><span>Sisa pembayaran</span><b>{money.format(outstanding)}</b><small>Pengajuan belum lunas</small></article><article><span>Pengajuan baru ({period} hari)</span><b>{requests.length}</b><small>Seluruh status pengajuan</small></article><article><span>Cicilan tercatat</span><b>{data.installments.filter((part) => part.status === "recorded").length} / {data.installments.length}</b><small>Potongan gaji</small></article></div>
        <section className="inventory-card"><div className="inventory-toolbar"><div><h2>Stok perlu diperiksa</h2><p>Barang dengan stok sama dengan atau di bawah batas minimum</p></div></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>BARANG</th><th>KATEGORI</th><th>STOK SAAT INI</th><th>BATAS MINIMUM</th><th>NILAI STOK</th></tr></thead><tbody>{!loading && lowStock.map((item) => <tr key={item.id}><td><div className="item-name"><span className="item-symbol">▤</span><span><b>{item.name}</b><small>{item.sku}</small></span></div></td><td>{item.category}</td><td><b>{item.current_stock} {item.unit}</b></td><td>{item.minimum_stock} {item.unit}</td><td>{money.format(item.current_stock * Number(item.unit_price))}</td></tr>)}</tbody></table>{loading && <div className="empty-state"><b>Memuat laporan…</b></div>}{!loading && lowStock.length === 0 && <div className="empty-state"><b>Tidak ada stok di bawah batas minimum</b></div>}</div></section>
        <section className="inventory-card report-movements"><div className="inventory-toolbar"><div><h2>Mutasi terbaru</h2><p>Hingga 100 transaksi dari {period} hari terakhir</p></div><a className="text-button" href="/mutasi">Buka semua mutasi →</a></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>TANGGAL</th><th>JENIS</th><th>BARANG</th><th>JUMLAH</th><th>NO. PENGAJUAN</th><th>CATATAN</th></tr></thead><tbody>{!loading && reportMovements.map((row) => { const item = itemById.get(row.item_id); const request = row.request_id ? data.requests.find((r) => r.id === row.request_id) : undefined; return <tr key={row.id}><td>{dateTime.format(new Date(row.created_at))}</td><td><span className="category-chip">{labels[row.movement]}</span></td><td><b>{item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang"}</b><small style={{ display: "block", color: "#9aa7ae" }}>{item?.sku}</small></td><td>{row.quantity} {item?.unit}</td><td>{request?.request_no ?? "—"}</td><td>{row.note ?? "—"}</td></tr>; })}</tbody></table>{!loading && reportMovements.length === 0 && <div className="empty-state"><b>Belum ada mutasi pada periode ini</b></div>}</div><div className="table-foot">Menampilkan <b>{reportMovements.length}</b> transaksi<span>Periode {period} hari</span></div></section>
      </div></section>
  </main>;
}

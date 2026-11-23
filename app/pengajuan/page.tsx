"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";
import { useAccess } from "@/app/components/access-context";

import { FormEvent, useEffect, useMemo, useState } from "react";
import SidebarProfile from "../components/sidebar-profile";
import RoleAvatar from "../components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = { id: string; code: string; name: string; category: string; variant: string; kind: "Perorangan" | "Habis pakai" | "Pinjaman"; unit: string; stock: number; minimum: number; location: string; price: number };
type Member = { id: string; full_name: string; employee_no: string | null; job_role: string; is_active: boolean };
type Installment = { id: string; number: number; amount: number; status: "Menunggu potong" | "Tercatat"; duePeriod?: string | null; paidAt?: string };
type Request = { id: string; dbId: string; memberId: string; itemId: string; itemCode: string; itemName: string; unit: string; quantity: number; fulfilledQuantity: number; member: string; role: string; paymentMethod: "Tunai" | "Potong gaji"; installmentCount: 0 | 2 | 3; total: number; paymentStatus: "Belum diproses" | "Menunggu pembayaran" | "Potongan berjalan" | "Lunas"; installments: Installment[]; status: "Menunggu persetujuan" | "Disetujui" | "Ditolak" | "Diserahkan"; createdAt: string; note: string };

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type DbItem = { id: string; sku: string; name: string; category: string; kind: "personal" | "consumable" | "loan"; variant: string; unit: string; current_stock: number; minimum_stock: number; location: string | null; unit_price: number; is_active: boolean };
type DbMember = { id: string; full_name: string; employee_no: string | null; job_role: string; is_active: boolean };
type DbRequest = { id: string; request_no: string; member_id: string; item_id: string; quantity: number; fulfilled_quantity: number; status: "pending" | "approved" | "rejected" | "delivered"; payment_method: "cash" | "payroll"; installment_count: 0 | 2 | 3; total_amount: number; note: string | null; created_at: string };
type DbPayment = { id: string; request_id: string; status: "unpaid" | "payroll_scheduled" | "partial" | "paid" };
type DbInstallment = { id: string; payment_id: string; installment_no: number; amount: number; status: "scheduled" | "recorded"; due_period: string | null; recorded_at: string | null };

async function fetchRequestData() {
  const supabase = createSupabaseBrowserClient();
  const [itemsResult, membersResult, requestsResult, paymentsResult, installmentsResult] = await Promise.all([
    supabase.from("items").select("id,sku,name,category,variant,kind,unit,current_stock,minimum_stock,location,unit_price,is_active").eq("is_active", true).order("name"),
    supabase.from("members").select("id,full_name,employee_no,job_role,is_active").eq("is_active", true).order("full_name"),
    supabase.from("requests").select("id,request_no,member_id,item_id,quantity,fulfilled_quantity,status,payment_method,installment_count,total_amount,note,created_at").order("created_at", { ascending: false }),
    supabase.from("payments").select("id,request_id,status"),
    supabase.from("payment_installments").select("id,payment_id,installment_no,amount,status,due_period,recorded_at").order("installment_no"),
  ]);
  const failed = [itemsResult, membersResult, requestsResult, paymentsResult, installmentsResult].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const dbItems = (itemsResult.data ?? []) as DbItem[];
  const dbMembers = (membersResult.data ?? []) as DbMember[];
  const dbRequests = (requestsResult.data ?? []) as DbRequest[];
  const dbPayments = (paymentsResult.data ?? []) as DbPayment[];
  const dbInstallments = (installmentsResult.data ?? []) as DbInstallment[];
  const items: Item[] = dbItems.map((item) => ({ id: item.id, code: item.sku, name: item.name, category: item.category, variant: item.variant || "",
    kind: item.kind === "consumable" ? "Habis pakai" : item.kind === "loan" ? "Pinjaman" : "Perorangan",
    unit: item.unit, stock: item.current_stock, minimum: item.minimum_stock, location: item.location || "Belum ditentukan", price: Number(item.unit_price) }));
  const members: Member[] = dbMembers;
  const itemById = new Map(dbItems.map((item) => [item.id, item]));
  const memberById = new Map(dbMembers.map((member) => [member.id, member]));
  const paymentByRequestId = new Map(dbPayments.map((payment) => [payment.request_id, payment]));
  const installmentsByPaymentId = new Map<string, Installment[]>();
  dbInstallments.forEach((part) => {
    const row = installmentsByPaymentId.get(part.payment_id) ?? [];
    row.push({ id: part.id, number: part.installment_no, amount: Number(part.amount), status: part.status === "recorded" ? "Tercatat" : "Menunggu potong", duePeriod: part.due_period, paidAt: part.recorded_at ?? undefined });
    installmentsByPaymentId.set(part.payment_id, row);
  });
  const requests: Request[] = dbRequests.map((request) => {
    const item = itemById.get(request.item_id); const member = memberById.get(request.member_id);
    const payment = paymentByRequestId.get(request.id);
    const paymentStatus = payment?.status === "paid" ? "Lunas" : payment?.status === "partial" || payment?.status === "payroll_scheduled" ? "Potongan berjalan" : request.payment_method === "cash" ? "Menunggu pembayaran" : "Belum diproses";
    return { id: request.request_no, dbId: request.id, memberId: request.member_id, itemId: request.item_id,
      itemCode: item?.sku ?? "", itemName: item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang", unit: item?.unit ?? "unit",
      quantity: request.quantity, fulfilledQuantity: request.fulfilled_quantity, member: member?.full_name ?? "Anggota", role: member?.job_role ?? "Lainnya",
      paymentMethod: request.payment_method === "cash" ? "Tunai" : "Potong gaji", installmentCount: request.installment_count,
      total: Number(request.total_amount), paymentStatus, installments: payment ? installmentsByPaymentId.get(payment.id) ?? [] : [],
      status: request.status === "pending" ? "Menunggu persetujuan" : request.status === "approved" ? "Disetujui" : request.status === "rejected" ? "Ditolak" : "Diserahkan",
      createdAt: request.created_at, note: request.note ?? "" };
  });
  return { items, members, requests, dbRequests };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Permintaan ke Supabase gagal.";
}

export default function PengajuanPage() {
  const role = useAccess()?.role ?? "admin";
  const canReview = role === "admin" || role === "approver";
  const canRecordPayment = role === "admin" || role === "payroll";
  const canHandover = role === "admin" || role === "inventory";
  const canCreateRequest = role === "admin" || role === "inventory" || role === "member";
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [filter, setFilter] = useState("Semua");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "Potong gaji">("Tunai");
  const [installmentCount, setInstallmentCount] = useState<2 | 3>(2);
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    let active = true;
    fetchRequestData().then((data) => {
      if (!active) return;
      setItems(data.items); setMembers(data.members); setRequests(data.requests);
    }).catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedInventoryItem = items.find((item) => item.code === selectedItem);
  const total = (selectedInventoryItem?.price ?? 0) * requestQuantity;
  const visibleRequests = useMemo(() => requests.filter((request) => filter === "Semua" || request.status === filter), [requests, filter]);
  const pendingCount = requests.filter((request) => request.status === "Menunggu persetujuan").length;
  const readyCount = requests.filter((request) => request.status === "Disetujui").length;
  const installmentCountOpen = requests.reduce((sum, request) => sum + request.installments.filter((part) => part.status === "Menunggu potong").length, 0);

  async function refreshData() {
    const data = await fetchRequestData();
    setItems(data.items); setMembers(data.members); setRequests(data.requests);
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const inventoryItem = items.find((item) => item.code === String(data.get("itemCode")));
    if (!inventoryItem) { setError("Pilih barang yang tersedia di Data Barang."); return; }
    const quantity = Number(data.get("quantity"));
    if (!quantity || quantity < 1) { setError("Jumlah pengajuan minimal 1."); return; }
    if (quantity > inventoryItem.stock) { setError(`Jumlah pengajuan melebihi stok yang tersedia (${inventoryItem.stock} ${inventoryItem.unit}).`); return; }
    const member = members.find((entry) => entry.id === String(data.get("memberId")));
    if (!member) { setError("Pilih anggota yang sudah terdaftar di halaman Anggota."); return; }
    const method = paymentMethod;
    const count: 0 | 2 | 3 = method === "Tunai" ? 0 : installmentCount;
    setSaving(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: requestId, error: createError } = await supabase.rpc("create_inventory_request", {
        p_member_id: member.id, p_item_id: inventoryItem.id, p_quantity: quantity,
        p_method: method === "Tunai" ? "cash" : "payroll", p_installments: count,
        p_note: String(data.get("note")).trim() || null,
      });
      if (createError) throw createError;
      await refreshData();
      const created = (await fetchRequestData()).requests.find((request) => request.dbId === requestId);
      setNotice(`Pengajuan ${created?.id ?? "baru"} berhasil dibuat dan menunggu persetujuan.`);
      setShowForm(false); setFilter("Semua"); setRequestQuantity(1); setSelectedItem("");
    } catch (submitError) { setError(errorMessage(submitError)); }
    finally { setSaving(false); }
  }

  async function decideRequest(request: Request, approved: boolean) {
    setError(""); setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: reviewError } = await supabase.rpc("review_inventory_request", { p_request_id: request.dbId, p_approve: approved });
      if (reviewError) throw reviewError;
      await refreshData(); setNotice(approved ? `${request.id} disetujui.` : `${request.id} ditolak.`);
    } catch (actionError) { setError(errorMessage(actionError)); }
    finally { setSaving(false); }
  }

  async function markPaid(request: Request) {
    setError(""); setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: paymentError } = await supabase.rpc("record_cash_payment", { p_request_id: request.dbId });
      if (paymentError) throw paymentError;
      await refreshData(); setNotice(`Pembayaran tunai untuk ${request.id} ditandai lunas.`);
    } catch (actionError) { setError(errorMessage(actionError)); }
    finally { setSaving(false); }
  }

  async function markInstallment(request: Request, number: number) {
    const installment = request.installments.find((part) => part.number === number);
    if (!installment) return;
    setError(""); setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: installmentError } = await supabase.rpc("record_payroll_installment", { p_installment_id: installment.id, p_due_period: payrollPeriod });
      if (installmentError) throw installmentError;
      await refreshData(); setNotice(`Potongan ke-${number} untuk ${request.id} sudah dicatat.`);
    } catch (actionError) { setError(errorMessage(actionError)); }
    finally { setSaving(false); }
  }

  return <main className="shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link><div className="workspace-label">WORKSPACE</div><SidebarNav active="/pengajuan" /><div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div></aside>
    <section className="main-panel"><header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Pengajuan &amp; pembayaran</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><div className="top-divider"/><RoleAvatar /></div></header>
      <div className="content request-content"><div className="page-heading"><div><div className="eyebrow">PERMINTAAN ANGGOTA</div><h1>Pengajuan &amp; pembayaran</h1><p>Kelola persetujuan barang dan catat pembayaran anggota.</p></div>{canCreateRequest && <button className="primary-button" onClick={() => setShowForm(true)}><span>＋</span> Buat pengajuan</button>}</div>
        <div className="request-summary"><article><span>Menunggu persetujuan</span><b>{pendingCount}</b><small>Pengajuan baru</small></article><article><span>Siap diserahkan</span><b>{readyCount}</b><small>Disetujui dan siap scan</small></article><article><span>Potongan berjalan</span><b>{installmentCountOpen}</b><small>Cicilan belum tercatat</small></article><article><span>Nilai pengajuan</span><b>{money.format(requests.reduce((sum, request) => sum + request.total, 0))}</b><small>Seluruh pengajuan</small></article></div>
        {notice && <div className="success-notice"><span>✓</span>{notice}</div>}{error && <div className="form-error request-error">{error}</div>}
        <section className="request-card"><div className="request-toolbar"><div><h2>Daftar pengajuan</h2><p>Persetujuan, penyerahan, dan status pembayaran</p></div><label className="payroll-period">Periode potongan<input type="month" value={payrollPeriod} onChange={(event) => setPayrollPeriod(event.target.value)} /></label><select className="request-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option>Semua</option><option>Menunggu persetujuan</option><option>Disetujui</option><option>Diserahkan</option><option>Ditolak</option></select></div>
          {loading ? <div className="history-empty">Memuat pengajuan dari Supabase…</div> : visibleRequests.length === 0 ? <div className="history-empty">Belum ada pengajuan pada status ini.</div> : <div className="request-list">{visibleRequests.map((request) => <article className="request-row" key={request.dbId}><div className="request-main"><div className="request-avatar">{request.role === "Satpam" ? "S" : request.role === "OB" ? "O" : request.role === "Driver" ? "D" : "C"}</div><div className="request-person"><b>{request.member} <span>{request.role}</span></b><small>{request.itemName} · {request.quantity} {request.unit} · {request.id}</small><small>{new Date(request.createdAt).toLocaleString("id-ID")} {request.note ? `· ${request.note}` : ""}</small></div></div><div className="request-payment"><b>{money.format(request.total)}</b><small>{request.paymentMethod}{request.installmentCount ? ` · ${request.installmentCount} kali` : ""}</small><span className={`payment-state ${request.paymentStatus === "Lunas" ? "paid" : request.paymentStatus === "Potongan berjalan" ? "scheduled" : "unpaid"}`}>{request.paymentStatus}</span></div><div className="request-status-col"><span className={`request-status ${request.status === "Disetujui" ? "approved" : request.status === "Diserahkan" ? "delivered" : request.status === "Ditolak" ? "rejected" : "waiting"}`}>{request.status}</span>{canReview && request.status === "Menunggu persetujuan" && <div className="decision-actions"><button disabled={saving} onClick={() => decideRequest(request, true)}>Setujui</button><button disabled={saving} onClick={() => decideRequest(request, false)}>Tolak</button></div>}{canRecordPayment && request.status === "Disetujui" && request.paymentMethod === "Tunai" && request.paymentStatus !== "Lunas" && <button className="small-action" disabled={saving} onClick={() => markPaid(request)}>Catat tunai lunas</button>}{canHandover && request.status === "Disetujui" && (request.paymentMethod === "Potong gaji" || request.paymentStatus === "Lunas") && <a className="small-action scan-action" href="/scan">Siap scan keluar →</a>}{request.installments.length > 0 && <details className="installment-details"><summary>Lihat cicilan</summary>{request.installments.map((part) => <div className="installment-row" key={part.number}><span>Cicilan {part.number}: {money.format(part.amount)}</span>{part.status === "Tercatat" ? <b>Sudah dipotong{part.duePeriod ? ` · ${new Date(`${part.duePeriod}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}` : ""}</b> : request.status === "Diserahkan" && canRecordPayment ? <button disabled={saving || !payrollPeriod} onClick={() => markInstallment(request, part.number)}>Catat potongan</button> : request.status === "Diserahkan" ? <small>Menunggu pencatatan payroll</small> : <small>Aktif setelah barang diserahkan</small>}</div>)}</details>}</div></article>)}</div>}
          <div className="table-foot">Data pengajuan tersimpan di Supabase <span>Tersinkron dengan cloud</span></div>
        </section><footer>Inventaris Operasional <span>·</span> Persetujuan dan pembayaran anggota</footer>
      </div>
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}><section className="item-modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><div className="modal-heading"><div><div className="eyebrow">PENGAJUAN BARANG</div><h2 id="request-title">Buat pengajuan anggota</h2><p>Pengajuan masuk ke daftar untuk disetujui admin.</p></div><button className="modal-close" onClick={() => !saving && setShowForm(false)} aria-label="Tutup">×</button></div>{members.length === 0 && <div className="login-setup-note"><b>Data anggota belum tersedia</b><span>Tambahkan anggota terlebih dahulu di halaman <a href="/anggota">Anggota</a>.</span></div>}<form onSubmit={createRequest}><div className="form-grid"><label className="form-field full"><span>Anggota <i>*</i></span><select name="memberId" required defaultValue=""><option value="">Pilih anggota terdaftar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.employee_no ? ` · ${member.employee_no}` : ""} · {member.job_role}</option>)}</select></label><label className="form-field"><span>Barang <i>*</i></span><select name="itemCode" required value={selectedItem} onChange={(event) => setSelectedItem(event.target.value)}><option value="">Pilih barang</option>{items.filter((item) => item.stock > 0).map((item) => <option key={item.code} value={item.code}>{item.name}{item.variant ? ` · ${item.variant}` : ""} · stok {item.stock}</option>)}</select></label><label className="form-field"><span>Jumlah <i>*</i></span><input name="quantity" type="number" min="1" max={selectedInventoryItem?.stock ?? undefined} required value={requestQuantity} onChange={(event) => setRequestQuantity(Number(event.target.value))}/></label><label className="form-field"><span>Metode pembayaran <i>*</i></span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "Tunai" | "Potong gaji")}><option>Tunai</option><option>Potong gaji</option></select></label>{paymentMethod === "Potong gaji" && <label className="form-field"><span>Jumlah pemotongan</span><select value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value) as 2 | 3)}><option value={2}>2 kali</option><option value={3}>3 kali</option></select></label>}<label className="form-field full"><span>Catatan keperluan</span><input name="note" placeholder="Misalnya: ukuran, lokasi, atau alasan penggantian"/></label></div><div className="request-total"><span>Perkiraan nilai pengajuan</span><b>{money.format(total)}</b></div><div className="qr-hint"><span>i</span><div><b>Alur pembayaran</b><small>Tunai dicatat lunas sebelum barang keluar. Potong gaji dibuatkan jadwal 2 atau 3 kali.</small></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)} disabled={saving}>Batal</button><button type="submit" className="primary-button" disabled={saving || loading || members.length === 0 || items.length === 0}>{saving ? "Menyimpan…" : "Kirim pengajuan"}</button></div></form></section></div>}
  </main>;
}

"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import SidebarProfile from "../components/sidebar-profile";
import RoleAvatar from "../components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InventoryItem = { id: string; code: string; name: string; category: string; variant: string; kind: "Perorangan" | "Habis pakai" | "Pinjaman"; unit: string; stock: number; minimum: number; location: string; price: number };
type RequestRecord = { id: string; itemCode: string; itemName: string; unit: string; quantity: number; fulfilledQuantity: number; member: string; role: string; paymentMethod: "Tunai" | "Potong gaji"; paymentStatus: string; status: "Menunggu persetujuan" | "Disetujui" | "Ditolak" | "Diserahkan"; createdAt: string; note: string };
type Transaction = { id: string; itemCode: string; itemName: string; requestId?: string; quantity: number; returnedQuantity: number; unit: string; member: string; role: string; action: "Keluar" | "Dipinjam"; returnable: boolean; status: "Keluar" | "Dipinjam" | "Sebagian kembali" | "Kembali"; date: string; note: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

type ScanData = { items: InventoryItem[]; requests: RequestRecord[]; transactions: Transaction[] };
type DbItem = { id: string; sku: string; name: string; category: string; kind: "personal" | "consumable" | "loan"; unit: string; current_stock: number; minimum_stock: number; location: string | null; unit_price: number; variant: string };
type DbRequest = { id: string; request_no: string; member_id: string; item_id: string; quantity: number; fulfilled_quantity: number; returned_quantity: number; status: "pending" | "approved" | "rejected" | "delivered"; payment_method: "cash" | "payroll"; total_amount: number; note: string | null; created_at: string };
type DbMember = { id: string; full_name: string; job_role: string };
type DbPayment = { request_id: string; status: "unpaid" | "payroll_scheduled" | "partial" | "paid" };
type DbMovement = { request_id: string | null; created_at: string };

async function fetchScanData(): Promise<ScanData> {
  const supabase = createSupabaseBrowserClient();
  const [itemsResult, requestsResult, membersResult, paymentsResult, movementsResult] = await Promise.all([
    supabase.from("items").select("id,sku,name,category,variant,kind,unit,current_stock,minimum_stock,location,unit_price").eq("is_active", true).order("name"),
    supabase.from("requests").select("id,request_no,member_id,item_id,quantity,fulfilled_quantity,returned_quantity,status,payment_method,total_amount,note,created_at").order("created_at", { ascending: false }),
    supabase.from("members").select("id,full_name,job_role"),
    supabase.from("payments").select("request_id,status"),
    supabase.from("stock_movements").select("request_id,created_at").not("request_id", "is", null).order("created_at", { ascending: false }).limit(2000),
  ]);
  const failed = [itemsResult, requestsResult, membersResult, paymentsResult, movementsResult].find((result) => result.error);
  if (failed?.error) throw failed.error;

  const items = (itemsResult.data ?? []).map((row) => {
    const item = row as DbItem;
    return { id: item.id, code: item.sku, name: item.variant ? `${item.name} · ${item.variant}` : item.name, category: item.category, variant: item.variant || "",
      kind: item.kind === "consumable" ? "Habis pakai" : item.kind === "loan" ? "Pinjaman" : "Perorangan",
      unit: item.unit, stock: item.current_stock, minimum: item.minimum_stock,
      location: item.location || "Belum ditentukan", price: Number(item.unit_price) } satisfies InventoryItem;
  });
  const itemById = new Map((itemsResult.data ?? []).map((row) => { const item = row as DbItem; return [item.id, item] as const; }));
  const memberById = new Map((membersResult.data ?? []).map((row) => { const member = row as DbMember; return [member.id, member] as const; }));
  const paymentByRequestId = new Map((paymentsResult.data ?? []).map((row) => { const payment = row as DbPayment; return [payment.request_id, payment] as const; }));
  const dbRequests = (requestsResult.data ?? []) as DbRequest[];
  const latestMovementByRequest = new Map<string, string>();
  for (const movement of (movementsResult.data ?? []) as DbMovement[]) {
    if (movement.request_id && !latestMovementByRequest.has(movement.request_id)) latestMovementByRequest.set(movement.request_id, movement.created_at);
  }
  const requests = dbRequests.map((request): RequestRecord => {
    const item = itemById.get(request.item_id);
    const member = memberById.get(request.member_id);
    const payment = paymentByRequestId.get(request.id);
    return { id: request.id, itemCode: item?.sku ?? "", itemName: item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang", unit: item?.unit ?? "unit",
      quantity: request.quantity, fulfilledQuantity: request.fulfilled_quantity, member: member?.full_name ?? "Anggota",
      role: member?.job_role ?? "Lainnya", paymentMethod: request.payment_method === "cash" ? "Tunai" : "Potong gaji",
      paymentStatus: payment?.status === "paid" ? "Lunas" : payment?.status === "partial" ? "Sebagian" : payment?.status === "payroll_scheduled" ? "Terjadwal" : "Belum bayar",
      status: request.status === "pending" ? "Menunggu persetujuan" : request.status === "approved" ? "Disetujui" : request.status === "rejected" ? "Ditolak" : "Diserahkan",
      createdAt: request.created_at, note: request.note ?? "" };
  });
  const transactions = dbRequests.filter((request) => request.fulfilled_quantity > 0).map((request): Transaction => {
    const item = itemById.get(request.item_id);
    const member = memberById.get(request.member_id);
    const returnable = item?.kind !== "consumable";
    const status: Transaction["status"] = request.returned_quantity >= request.fulfilled_quantity ? "Kembali" : request.returned_quantity > 0 ? "Sebagian kembali" : item?.kind === "loan" ? "Dipinjam" : "Keluar";
    return { id: request.id, requestId: request.id, itemCode: item?.sku ?? "", itemName: item ? `${item.name}${item.variant ? ` · ${item.variant}` : ""}` : "Barang",
      quantity: request.fulfilled_quantity, returnedQuantity: request.returned_quantity, unit: item?.unit ?? "unit",
      member: member?.full_name ?? "Anggota", role: member?.job_role ?? "Lainnya", action: item?.kind === "loan" ? "Dipinjam" : "Keluar",
      returnable, status, date: latestMovementByRequest.get(request.id) ?? request.created_at, note: request.note ?? "" };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { items, requests, transactions };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Permintaan ke Supabase gagal.";
}

export default function ScanPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"Keluar" | "Kembali">("Keluar");
  const [code, setCode] = useState("");
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loanId, setLoanId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchScanData().then((data) => {
      if (!active) return;
      setItems(data.items); setRequests(data.requests); setTransactions(data.transactions);
    }).catch((loadError: unknown) => {
      if (active) setError(errorMessage(loadError));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openLoans = useMemo(() => transactions.filter((transaction) => transaction.itemCode === item?.code && transaction.returnable && transaction.quantity > transaction.returnedQuantity), [transactions, item]);
  const selectedLoan = openLoans.find((transaction) => transaction.id === loanId) ?? openLoans[0];
  const eligibleRequests = useMemo(() => requests.filter((request) => request.itemCode === item?.code && request.status === "Disetujui" && request.quantity > request.fulfilledQuantity && (request.paymentMethod === "Potong gaji" || request.paymentStatus === "Lunas")), [requests, item]);
  const selectedRequest = eligibleRequests.find((request) => request.id === requestId) ?? eligibleRequests[0];

  function findItem(value: string) {
    if (loading) { setError("Data barang masih dimuat dari Supabase. Coba beberapa saat lagi."); return; }
    const normalizedCode = value.trim().toUpperCase();
    const found = items.find((candidate) => candidate.code.toUpperCase() === normalizedCode);
    setError("");
    setNotice("");
    setCode(normalizedCode);
    setItem(found ?? null);
    setLoanId("");
    setRequestId("");
    if (!found) setError(`Kode ${normalizedCode || ""} tidak ditemukan. Pastikan barang sudah tercatat di Data Barang.`);
  }

  function stopCamera() {
    scanRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  async function startCamera() {
    setError("");
    setCameraMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di browser ini. Masukkan kode inventaris secara manual.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) throw new Error("Video preview is not ready");
      video.srcObject = stream;
      await video.play();
      const DetectorClass = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorClass) {
        setCameraMessage("Browser ini belum mendukung deteksi QR otomatis. Kamera aktif; masukkan kode barang yang terlihat di label pada kolom di bawah.");
        return;
      }
      setCameraMessage("Arahkan kamera ke QR barang.");
      const detector = new DetectorClass({ formats: ["qr_code"] });
      scanRef.current = true;
      const scanFrame = async () => {
        if (!scanRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found[0]?.rawValue) {
            const detectedCode = found[0].rawValue;
            stopCamera();
            findItem(detectedCode);
            return;
          }
        } catch {
          setCameraMessage("Belum berhasil membaca QR. Coba dekatkan kamera atau masukkan kodenya manual.");
        }
        requestAnimationFrame(scanFrame);
      };
      requestAnimationFrame(scanFrame);
    } catch {
      stopCamera();
      setError("Izin kamera belum diberikan atau kamera sedang digunakan aplikasi lain.");
    }
  }

  useEffect(() => () => {
    scanRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function submitExit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    if (!selectedRequest) {
      setError("Barang keluar harus terkait dengan pengajuan yang disetujui dan siap diserahkan.");
      return;
    }
    const remainingRequest = selectedRequest.quantity - selectedRequest.fulfilledQuantity;
    if (quantity < 1 || quantity > Math.min(item.stock, remainingRequest)) {
      setError(`Jumlah keluar maksimal ${Math.min(item.stock, remainingRequest)} ${item.unit} sesuai stok dan sisa pengajuan.`);
      return;
    }
    const loan = item.kind === "Pinjaman";
    setSaving(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: movementError } = await supabase.rpc("record_stock_movement", {
        p_item_id: item.id, p_movement: "outbound", p_quantity: quantity,
        p_request_id: selectedRequest.id, p_note: String(form.get("note")).trim() || null,
      });
      if (movementError) throw movementError;
      const data = await fetchScanData();
      setItems(data.items); setRequests(data.requests); setTransactions(data.transactions);
      setItem(data.items.find((candidate) => candidate.id === item.id) ?? null);
      setNotice(`${quantity} ${item.unit} ${item.name} diserahkan kepada ${selectedRequest.member} berdasarkan ${selectedRequest.id}${loan ? " sebagai barang pinjaman" : ""}.`);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    } finally {
      setSaving(false);
    }
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !selectedLoan) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const outstanding = selectedLoan.quantity - selectedLoan.returnedQuantity;
    if (quantity < 1 || quantity > outstanding) {
      setError(`Jumlah pengembalian harus antara 1 dan ${outstanding} ${item.unit}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: movementError } = await supabase.rpc("record_stock_movement", {
        p_item_id: item.id, p_movement: "return", p_quantity: quantity,
        p_request_id: selectedLoan.requestId ?? selectedLoan.id, p_note: "Pengembalian barang",
      });
      if (movementError) throw movementError;
      const data = await fetchScanData();
      setItems(data.items); setRequests(data.requests); setTransactions(data.transactions);
      setItem(data.items.find((candidate) => candidate.id === item.id) ?? null);
      setNotice(`${quantity} ${item.unit} ${item.name} diterima kembali dari ${selectedLoan.member}. Stok bertambah.`);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link>
        <div className="workspace-label">WORKSPACE</div>
        <SidebarNav active="/scan" />
        <div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Scan QR &amp; mutasi barang</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><div className="top-divider"/><RoleAvatar /></div></header>
        <div className="content scan-content">
          <div className="page-heading"><div><div className="eyebrow">TRANSAKSI INVENTARIS</div><h1>Scan QR &amp; mutasi barang</h1><p>Pindai kode barang untuk mencatat penyerahan atau pengembalian.</p></div><a className="outline-button button-link" href="/data-barang">Lihat data barang <span>→</span></a></div>
          <div className="transaction-layout">
            <section className="scan-card">
              <div className="mode-toggle"><button className={mode === "Keluar" ? "mode-option active" : "mode-option"} onClick={() => { setMode("Keluar"); setItem(null); setNotice(""); setError(""); }}>Barang keluar</button><button className={mode === "Kembali" ? "mode-option active" : "mode-option"} onClick={() => { setMode("Kembali"); setItem(null); setNotice(""); setError(""); }}>Pengembalian</button></div>
              <div className="scan-intro"><div className="info-icon scan">⌗</div><div><h2>{mode === "Keluar" ? "Pindai barang yang akan keluar" : "Pindai barang yang dikembalikan"}</h2><p>{mode === "Keluar" ? "QR akan mengisi data barang dan stok yang tersedia." : "Pilih transaksi pinjaman yang cocok untuk memperbarui stok."}</p></div></div>
              {cameraOpen && <div className="camera-wrap"><video ref={videoRef} playsInline muted/><div className="camera-corners"/><button className="camera-stop" onClick={stopCamera}>Tutup kamera</button><p>{cameraMessage}</p></div>}
              <button className="camera-button" disabled={loading || saving} onClick={cameraOpen ? stopCamera : startCamera}><span>⌗</span>{cameraOpen ? "Matikan kamera" : loading ? "Memuat data barang…" : "Buka pemindai kamera"}</button>
              <div className="manual-divider"><span>atau masukkan kode barang</span></div>
              <form className="code-entry" onSubmit={(event) => { event.preventDefault(); findItem(code); }}><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Contoh: INV-0003" aria-label="Kode inventaris"/><button className="primary-button" type="submit" disabled={loading || saving}>Cari barang</button></form>
              <div className="scan-note"><span>i</span><p>QR label berisi kode inventaris. Barang dicatat atas nama anggota; pengembalian barang yang dapat dipakai ulang akan menambah stok kembali.</p></div>
            </section>

            <section className="transaction-card">
              {!item ? <div className="scan-empty"><div className="empty-qr">⌗</div><h2>Menunggu kode barang</h2><p>Mulai dengan scan QR atau masukkan kode inventaris secara manual.</p></div> : <>
                <div className="selected-item"><div className="item-symbol">{item.category === "Chemical" ? "◉" : item.category === "Sepatu" ? "◒" : "▧"}</div><div><small>{item.code} · {item.category}</small><h2>{item.name}</h2><p>Stok tersedia <b>{item.stock} {item.unit}</b> <span>·</span> {item.kind}</p></div></div>
                {mode === "Keluar" ? <>{eligibleRequests.length === 0 ? <div className="no-loan"><b>Belum ada pengajuan siap diserahkan</b><p>Setujui pengajuan dan catat pembayaran tunai, atau pilih metode potong gaji di menu pengajuan.</p><a className="small-action scan-action" href="/pengajuan">Buka pengajuan →</a></div> : <form className="transaction-form" onSubmit={submitExit}><label className="form-field"><span>Pengajuan anggota <i>*</i></span><select value={selectedRequest?.id ?? ""} onChange={(event) => setRequestId(event.target.value)}>{eligibleRequests.map((request) => <option key={request.id} value={request.id}>{request.member} · {request.id} · sisa {request.quantity - request.fulfilledQuantity} {request.unit}</option>)}</select></label><div className="loan-summary"><span>Anggota · {selectedRequest?.role}</span><b>{selectedRequest?.member}</b><small>{selectedRequest?.paymentMethod}{selectedRequest?.paymentMethod === "Tunai" ? " · Lunas" : ` · ${selectedRequest?.paymentStatus}`} · diajukan {selectedRequest ? new Date(selectedRequest.createdAt).toLocaleDateString("id-ID") : ""}</small></div><label className="form-field"><span>Jumlah diserahkan <i>*</i></span><input name="quantity" type="number" min="1" max={Math.min(item.stock, selectedRequest ? selectedRequest.quantity - selectedRequest.fulfilledQuantity : 0)} defaultValue="1" required/></label><div className="transaction-rule"><span>↗</span><p>{item.kind === "Pinjaman" ? "Barang ini dicatat sebagai pinjaman. Stok akan tersedia kembali setelah dikembalikan." : item.kind === "Habis pakai" ? "Barang habis pakai akan mengurangi stok sesuai jumlah yang digunakan." : "Barang diserahkan berdasarkan pengajuan yang telah disetujui."}</p></div><button className="primary-button transaction-submit" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Konfirmasi barang keluar"}</button></form>}</> : <>
                  {openLoans.length === 0 ? <div className="no-loan"><b>Tidak ada transaksi terbuka yang bisa dikembalikan</b><p>Barang habis pakai tidak dapat diproses sebagai pengembalian stok.</p></div> : <form className="transaction-form" onSubmit={submitReturn}><label className="form-field"><span>Transaksi anggota</span><select value={selectedLoan?.id ?? ""} onChange={(event) => setLoanId(event.target.value)}>{openLoans.map((loan) => <option key={loan.id} value={loan.id}>{loan.member} · {loan.quantity - loan.returnedQuantity} {loan.unit} belum kembali</option>)}</select></label><div className="loan-summary"><span>Penerima</span><b>{selectedLoan?.member}</b><small>{selectedLoan?.role} · keluar {selectedLoan ? new Date(selectedLoan.date).toLocaleDateString("id-ID") : ""}</small></div><label className="form-field"><span>Jumlah yang dikembalikan <i>*</i></span><input name="quantity" type="number" min="1" max={selectedLoan ? selectedLoan.quantity - selectedLoan.returnedQuantity : 0} defaultValue="1" required/></label><div className="transaction-rule returned-rule"><span>↙</span><p>Stok akan bertambah setelah pengembalian dicatat. Pengembalian sebagian tetap menyimpan sisa barang pada anggota.</p></div><button className="primary-button transaction-submit" type="submit" disabled={saving}>{saving ? "Mencatat…" : "Catat pengembalian"}</button></form>}
                </>}
              </>}
              {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="success-notice transaction-notice" role="status"><span>✓</span>{notice}</div>}
            </section>
          </div>
          <section className="recent-transactions"><div className="section-heading"><div><h2>Transaksi terbaru</h2><p>Catatan barang keluar dan pengembalian tersimpan di cloud</p></div><span className="local-tag">SUPABASE</span></div>{transactions.length === 0 ? <div className="history-empty">{loading ? "Memuat transaksi…" : "Belum ada transaksi yang dicatat."}</div> : <div className="transaction-list">{transactions.slice(0, 6).map((transaction) => <article className="transaction-row" key={transaction.id}><div className={`transaction-avatar ${transaction.status === "Kembali" ? "back" : ""}`}>{transaction.status === "Kembali" || transaction.status === "Sebagian kembali" ? "↙" : "↗"}</div><div className="transaction-desc"><b>{transaction.itemName}</b><small>{transaction.member} · {transaction.role} · {new Date(transaction.date).toLocaleString("id-ID")}</small></div><span className="transaction-qty">{transaction.quantity - transaction.returnedQuantity}/{transaction.quantity} {transaction.unit}</span><span className={`transaction-status ${transaction.status === "Kembali" ? "returned" : transaction.status === "Dipinjam" ? "borrowed" : "issued"}`}>{transaction.status}</span></article>)}</div>}</section>
          <footer>Inventaris Operasional <span>·</span> Mutasi stok dan pengembalian tersimpan di Supabase</footer>
        </div>
      </section>
    </main>
  );
}

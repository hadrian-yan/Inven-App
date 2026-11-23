"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarNav, { SettingsNav } from "@/app/components/sidebar-nav";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import SidebarProfile from "../components/sidebar-profile";
import RoleAvatar from "../components/role-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = {
  id?: string;
  code: string;
  name: string;
  category: string;
  variant: string;
  kind: "Perorangan" | "Habis pakai" | "Pinjaman";
  unit: string;
  stock: number;
  minimum: number;
  location: string;
  price: number;
  qrDataUrl?: string;
};

type DbItem = {
  id: string; sku: string; name: string; category: string; variant: string; kind: "personal" | "consumable" | "loan";
  unit: string; current_stock: number; minimum_stock: number; location: string | null; unit_price: number; qr_payload: string;
};

function fromDatabase(row: DbItem): Item {
  return {
    id: row.id, code: row.sku, name: row.name, category: row.category, variant: row.variant || "",
    kind: row.kind === "consumable" ? "Habis pakai" : row.kind === "loan" ? "Pinjaman" : "Perorangan",
    unit: row.unit, stock: row.current_stock, minimum: row.minimum_stock,
    location: row.location || "Belum ditentukan", price: Number(row.unit_price),
    qrDataUrl: undefined,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const details = "details" in error && typeof error.details === "string" ? error.details : "";
    const code = "code" in error && typeof error.code === "string" ? ` (kode ${error.code})` : "";
    return `${error.message}${code}${details ? ` — ${details}` : ""}`;
  }
  return fallback;
}

const categories = ["Semua", "Seragam", "Sepatu", "Atribut", "Chemical", "Alat kebersihan"];
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
export default function DataBarangPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<Item | null>(null);
  const [selectedReceive, setSelectedReceive] = useState<Item | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [bulkLabels, setBulkLabels] = useState<Item[] | null>(null);
  const [generatingLabels, setGeneratingLabels] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadItems() {
      setLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.from("items")
          .select("id,sku,name,category,variant,kind,unit,current_stock,minimum_stock,location,unit_price,qr_payload")
          .eq("is_active", true).order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setItems((data ?? []).map((row) => fromDatabase(row as DbItem)));
      } catch (error) {
        if (active) {
          setNoticeError(true);
          setNotice(getErrorMessage(error, "Gagal memuat data dari Supabase."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadItems();
    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesCategory = category === "Semua" || item.category === category;
    const term = query.trim().toLowerCase();
    return matchesCategory && (!term || `${item.name} ${item.variant} ${item.code} ${item.location}`.toLowerCase().includes(term));
  }), [items, query, category]);

  async function addStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const quantity = Number(data.get("quantity"));
    const sku = `INV-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const kind = String(data.get("kind")) as Item["kind"];
    const dbKind = kind === "Habis pakai" ? "consumable" : kind === "Pinjaman" ? "loan" : "personal";
    setNotice("");
    setSaving(true);
    try {
      const qrDataUrl = await QRCode.toDataURL(sku, { width: 240, margin: 1, errorCorrectionLevel: "M" });
      const supabase = createSupabaseBrowserClient();
      const { data: inserted, error } = await supabase.rpc("create_inventory_item", {
        p_sku: sku, p_name: name, p_category: String(data.get("category")), p_variant: String(data.get("variant")).trim(), p_kind: dbKind,
        p_unit: String(data.get("unit")), p_initial_stock: quantity,
        p_minimum_stock: Number(data.get("minimum")) || 0,
        p_location: String(data.get("location")).trim() || null,
        p_unit_price: Number(data.get("price")) || 0,
      });
      if (error) throw error;
      const item = fromDatabase(inserted as DbItem);
      item.qrDataUrl = qrDataUrl;
      setItems((current) => [item, ...current]);
      setCategory("Semua");
      setQuery("");
      setShowForm(false);
      setSelectedLabel(item);
      setNoticeError(false);
      setNotice(`${name} tersimpan di Supabase. QR untuk kode ${sku} siap dicetak.`);
      window.setTimeout(() => setNotice(""), 5000);
    } catch (error) {
      setNoticeError(true);
      setNotice(getErrorMessage(error, "Barang tidak dapat disimpan ke Supabase."));
    } finally {
      setSaving(false);
    }
  }

  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedReceive?.id) return;
    const form = new FormData(event.currentTarget); const quantity = Number(form.get("quantity")); const note = String(form.get("note")).trim();
    setReceiving(true); setNotice("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("record_stock_movement", { p_item_id: selectedReceive.id, p_movement: "inbound", p_quantity: quantity, p_request_id: null, p_note: note || "Penambahan stok" });
      if (error) throw error;
      setItems((current) => current.map((item) => item.id === selectedReceive.id ? { ...item, stock: item.stock + quantity } : item));
      setNotice(`${quantity} ${selectedReceive.unit} ${selectedReceive.name} berhasil dicatat sebagai stok masuk.`); setNoticeError(false); setSelectedReceive(null); window.setTimeout(() => setNotice(""), 5000);
    } catch (error) { setNotice(getErrorMessage(error, "Stok masuk tidak dapat dicatat.")); setNoticeError(true); }
    finally { setReceiving(false); }
  }
  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedEdit?.id) return;
    const form = new FormData(event.currentTarget);
    setEditing(true); setNotice("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.from("items").update({
        name: String(form.get("name")).trim(), category: String(form.get("category")), variant: String(form.get("variant")).trim(),
        kind: String(form.get("kind")) === "Habis pakai" ? "consumable" : String(form.get("kind")) === "Pinjaman" ? "loan" : "personal",
        unit: String(form.get("unit")).trim(), minimum_stock: Number(form.get("minimum")) || 0,
        unit_price: Number(form.get("price")) || 0, location: String(form.get("location")).trim() || null,
      }).eq("id", selectedEdit.id).select("id,sku,name,category,variant,kind,unit,current_stock,minimum_stock,location,unit_price,qr_payload").single();
      if (error) throw error;
      const updated = fromDatabase(data as DbItem);
      setItems((current) => current.map((item) => item.id === updated.id ? { ...updated, qrDataUrl: item.qrDataUrl } : item));
      setSelectedEdit(null); setNotice(`Data ${updated.name} berhasil diperbarui.`); setNoticeError(false); window.setTimeout(() => setNotice(""), 5000);
    } catch (error) { setNotice(getErrorMessage(error, "Data barang tidak dapat diperbarui.")); setNoticeError(true); }
    finally { setEditing(false); }
  }
  async function showQrLabel(item: Item) {
    try {
      const qrDataUrl = item.qrDataUrl ?? await QRCode.toDataURL(item.code, { width: 240, margin: 1, errorCorrectionLevel: "M" });
      const updatedItem = { ...item, qrDataUrl };
      setItems((current) => current.map((currentItem) => currentItem.code === item.code ? updatedItem : currentItem));
      setSelectedLabel(updatedItem);
    } catch (error) {
      setNoticeError(true);
      setNotice(getErrorMessage(error, "Label QR tidak dapat dibuat."));
    }
  }

  async function showBulkLabels() {
    if (!items.length) return;
    setGeneratingLabels(true); setNotice("");
    try {
      const labels = await Promise.all(items.map(async (item) => ({ ...item, qrDataUrl: item.qrDataUrl ?? await QRCode.toDataURL(item.code, { width: 240, margin: 1, errorCorrectionLevel: "M" }) })));
      setBulkLabels(labels);
    } catch (error) { setNoticeError(true); setNotice(getErrorMessage(error, "Label QR tidak dapat dibuat.")); }
    finally { setGeneratingLabels(false); }
  }
  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image className="brand-mark" src="/logo.webp" alt="Logo perusahaan" width={40} height={40} priority /><span>inventaris<span className="brand-dot">.</span><small>OPERASIONAL</small></span></Link>
        <div className="workspace-label">WORKSPACE</div>
        <SidebarNav active="/data-barang" />
        <div className="sidebar-bottom"><div className="workspace-label">PENGELOLAAN</div><SettingsNav /><SidebarProfile /></div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Data barang</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><div className="top-divider"/><RoleAvatar /></div></header>
        <div className="content inventory-content">
          <div className="page-heading"><div><div className="eyebrow">MASTER INVENTARIS</div><h1>Data barang</h1><p>Kelola barang, stok, lokasi penyimpanan, dan nilai barang anggota.</p></div><div className="page-heading-actions"><button className="outline-button" onClick={() => void showBulkLabels()} disabled={loading || items.length === 0 || generatingLabels}>{generatingLabels ? "Menyiapkan QR…" : `Cetak semua QR (${items.length})`}</button><button className="primary-button" onClick={() => setShowForm(true)}><span>＋</span> Catat barang masuk</button></div></div>

          <div className="inventory-summary"><article><span>Total jenis barang</span><b>{items.length}</b><small>SKU terdaftar</small></article><article><span>Total stok tersedia</span><b>{items.reduce((sum, item) => sum + item.stock, 0).toLocaleString("id-ID")}</b><small>unit di seluruh lokasi</small></article><article><span>Stok perlu diisi</span><b className="low-number">{items.filter((item) => item.stock <= item.minimum).length}</b><small>di bawah batas minimum</small></article><article><span>Nilai perlengkapan</span><b>{money.format(items.reduce((sum, item) => sum + item.price * item.stock, 0))}</b><small>berdasarkan nilai barang</small></article></div>

          {notice && <div className={noticeError ? "success-notice error-notice" : "success-notice"} role={noticeError ? "alert" : "status"}><span>{noticeError ? "!" : "✓"}</span>{notice}</div>}

          <section className="inventory-card">
            <div className="inventory-toolbar"><div><h2>Daftar inventaris</h2><p>Barang yang tercatat di seluruh lokasi penyimpanan</p></div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, kode, atau lokasi..." aria-label="Cari barang" /></label></div>
            <div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "category-tab selected" : "category-tab"} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>BARANG</th><th>KATEGORI</th><th>JENIS</th><th>STOK</th><th>LOKASI SIMPAN</th><th>NILAI / UNIT</th><th>AKSI</th></tr></thead><tbody>{filteredItems.map((item) => <tr key={item.code}><td><div className="item-name"><span className="item-symbol">{item.category === "Chemical" ? "◉" : item.category === "Sepatu" ? "◒" : item.category === "Alat kebersihan" ? "⌁" : "▧"}</span><div><b>{item.name}</b><small>{item.code}{item.variant ? ` · ${item.variant}` : ""}</small></div></div></td><td><span className="category-chip">{item.category}</span></td><td><span className={`kind-label ${item.kind === "Habis pakai" ? "consumable" : item.kind === "Pinjaman" ? "loan" : "personal"}`}>{item.kind}</span></td><td><div className="stock-count"><b className={item.stock <= item.minimum ? "stock-low" : ""}>{item.stock}</b><small>{item.unit}{item.stock <= item.minimum ? " · Stok menipis" : ` · Min. ${item.minimum}`}</small></div></td><td className="location-cell">{item.location}</td><td className="price-cell">{item.price ? money.format(item.price) : "—"}</td><td><div className="item-actions"><button className="qr-code" onClick={() => showQrLabel(item)} title={`Lihat atau cetak QR ${item.code}`} aria-label={`Lihat atau cetak QR ${item.code}`}>▦<small>{item.code}</small></button><button className="stock-add-button" onClick={() => setSelectedReceive(item)} title={`Tambah stok ${item.name}`} aria-label={`Tambah stok ${item.name}`}>＋ Stok</button><button className="item-edit-button" onClick={() => setSelectedEdit(item)} title={`Edit data ${item.name}`} aria-label={`Edit data ${item.name}`}>Edit</button></div></td></tr>)}</tbody></table>{filteredItems.length === 0 && <div className="empty-state"><span>{loading ? "◌" : "⌕"}</span><b>{loading ? "Memuat barang…" : items.length === 0 ? "Belum ada barang di Supabase" : "Barang tidak ditemukan"}</b><p>{loading ? "Mengambil daftar inventaris dari cloud." : items.length === 0 ? "Catat barang masuk untuk mulai mengisi inventaris." : "Coba ubah kata pencarian atau kategori."}</p></div>}</div>
          <div className="table-foot">Menampilkan <b>{filteredItems.length}</b> dari <b>{items.length}</b> jenis barang <span>{loading ? "Memuat dari Supabase…" : "Tersimpan di Supabase"}</span></div>
          </section>
          <footer>Inventaris Operasional <span>·</span> Versi awal</footer>
        </div>
      </section>

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}><section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="eyebrow">TRANSAKSI INVENTARIS</div><h2 id="modal-title">Catat barang masuk</h2><p>Masukkan data barang yang diterima gudang.</p></div><button className="modal-close" onClick={() => !saving && setShowForm(false)} aria-label="Tutup">×</button></div><form onSubmit={addStock}><div className="form-grid"><label className="form-field full"><span>Nama barang <i>*</i></span><input name="name" required placeholder="Contoh: Kemeja kerja lengan panjang" autoFocus /></label><label className="form-field"><span>Kategori <i>*</i></span><select name="category" required defaultValue=""><option value="" disabled>Pilih kategori</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Varian / ukuran</span><input name="variant" placeholder="Contoh: Kemeja navy · ukuran L" /></label><label className="form-field"><span>Jenis barang <i>*</i></span><select name="kind" required defaultValue="Perorangan"><option>Perorangan</option><option>Habis pakai</option><option>Pinjaman</option></select></label><label className="form-field"><span>Jumlah masuk <i>*</i></span><input name="quantity" type="number" min="1" required placeholder="0" /></label><label className="form-field"><span>Satuan <i>*</i></span><select name="unit" required defaultValue="pcs"><option>pcs</option><option>pasang</option><option>liter</option><option>botol</option><option>jeriken</option><option>paket</option></select></label><label className="form-field"><span>Batas stok minimum</span><input name="minimum" type="number" min="0" placeholder="0" /></label><label className="form-field"><span>Nilai per unit (Rp)</span><input name="price" type="number" min="0" placeholder="0" /></label><label className="form-field full"><span>Lokasi penyimpanan</span><input name="location" placeholder="Contoh: Gudang Utama · Rak A1" /></label></div><div className="qr-hint"><span>▦</span><div><b>QR unik dibuat otomatis</b><small>Setelah tersimpan, label QR dapat dilihat dan dicetak.</small></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)} disabled={saving}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan & buat QR"}</button></div></form></section></div>}
      {selectedEdit && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !editing) setSelectedEdit(null); }}><section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title"><div className="modal-heading"><div><div className="eyebrow">MASTER INVENTARIS</div><h2 id="edit-item-title">Edit data barang</h2><p>SKU {selectedEdit.code} tetap digunakan untuk QR dan riwayat mutasi.</p></div><button className="modal-close" onClick={() => !editing && setSelectedEdit(null)} aria-label="Tutup">×</button></div><form onSubmit={updateItem}><div className="form-grid"><label className="form-field full"><span>Nama barang <i>*</i></span><input name="name" required defaultValue={selectedEdit.name} autoFocus /></label><label className="form-field"><span>Kategori <i>*</i></span><select name="category" required defaultValue={selectedEdit.category}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Varian / ukuran</span><input name="variant" defaultValue={selectedEdit.variant} placeholder="Contoh: Kemeja navy · ukuran L" /></label><label className="form-field"><span>Jenis barang <i>*</i></span><select name="kind" required defaultValue={selectedEdit.kind}><option>Perorangan</option><option>Habis pakai</option><option>Pinjaman</option></select></label><label className="form-field"><span>Satuan <i>*</i></span><input name="unit" required defaultValue={selectedEdit.unit} /></label><label className="form-field"><span>Batas stok minimum</span><input name="minimum" type="number" min="0" defaultValue={selectedEdit.minimum} /></label><label className="form-field"><span>Nilai per unit (Rp)</span><input name="price" type="number" min="0" defaultValue={selectedEdit.price} /></label><label className="form-field"><span>Lokasi penyimpanan</span><input name="location" defaultValue={selectedEdit.location === "Belum ditentukan" ? "" : selectedEdit.location} placeholder="Contoh: Gudang utama · Rak A1" /></label></div><div className="qr-hint"><span>i</span><div><b>Stok tidak berubah</b><small>Perubahan jumlah stok dicatat terpisah melalui tombol Tambah stok.</small></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setSelectedEdit(null)} disabled={editing}>Batal</button><button type="submit" className="primary-button" disabled={editing}>{editing ? "Menyimpan…" : "Simpan perubahan"}</button></div></form></section></div>}      {selectedReceive && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !receiving) setSelectedReceive(null); }}><section className="item-modal stock-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><div className="modal-heading"><div><div className="eyebrow">TRANSAKSI STOK</div><h2 id="receipt-title">Tambah stok barang</h2><p>{selectedReceive.name} · {selectedReceive.code} · tersedia {selectedReceive.stock} {selectedReceive.unit}</p></div><button className="modal-close" onClick={() => !receiving && setSelectedReceive(null)} aria-label="Tutup">×</button></div><form onSubmit={receiveStock}><div className="form-grid"><label className="form-field full"><span>Jumlah masuk <i>*</i></span><input name="quantity" type="number" min="1" required placeholder="Masukkan jumlah diterima" autoFocus /></label><label className="form-field full"><span>Catatan penerimaan</span><input name="note" placeholder="Contoh: Pembelian PO-001 atau pengisian ulang" /></label></div><div className="qr-hint"><span>↗</span><div><b>Riwayat stok akan diperbarui</b><small>Jumlah bertambah dan transaksi masuk tercatat di halaman Mutasi barang.</small></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setSelectedReceive(null)} disabled={receiving}>Batal</button><button type="submit" className="primary-button" disabled={receiving}>{receiving ? "Mencatat…" : "Simpan stok masuk"}</button></div></form></section></div>}      {selectedLabel && <div className="qr-preview-backdrop"><section className="qr-preview" role="dialog" aria-modal="true" aria-labelledby="qr-title"><button className="modal-close qr-dismiss" onClick={() => setSelectedLabel(null)} aria-label="Tutup">×</button><div className="print-label"><div className="label-brand">INVENTARIS OPERASIONAL</div>{selectedLabel.qrDataUrl && <Image src={selectedLabel.qrDataUrl} alt={`QR ${selectedLabel.code}`} width={240} height={240} unoptimized />}<h2 id="qr-title">{selectedLabel.name}</h2>{selectedLabel.variant && <small className="qr-variant">{selectedLabel.variant}</small>}<p>{selectedLabel.code}</p></div><div className="qr-preview-actions"><button className="cancel-button" onClick={() => setSelectedLabel(null)}>Tutup</button><button className="primary-button" onClick={() => window.print()}>Cetak label QR</button></div></section></div>}
      {bulkLabels && <div className="qr-preview-backdrop"><section className="qr-preview bulk-qr-preview" role="dialog" aria-modal="true" aria-labelledby="bulk-qr-title"><button className="modal-close qr-dismiss" onClick={() => setBulkLabels(null)} aria-label="Tutup">×</button><div className="modal-heading"><div><div className="eyebrow">CETAK LABEL INVENTARIS</div><h2 id="bulk-qr-title">Semua QR barang</h2><p>{bulkLabels.length} label siap dicetak · kertas A4, dua kolom</p></div></div><div className="bulk-label-grid">{bulkLabels.map((item) => <article className="bulk-print-label" key={item.code}><div className="label-brand">INVENTARIS OPERASIONAL</div>{item.qrDataUrl && <Image src={item.qrDataUrl} alt={`QR ${item.code}`} width={240} height={240} unoptimized />}<h3>{item.name}</h3>{item.variant && <small className="qr-variant">{item.variant}</small>}<p>{item.code}</p></article>)}</div><div className="qr-preview-actions"><button className="cancel-button" onClick={() => setBulkLabels(null)}>Tutup</button><button className="primary-button" onClick={() => window.print()}>Cetak {bulkLabels.length} label</button></div></section></div>}    </main>
  );
}

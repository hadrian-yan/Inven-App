# Kesiapan Operasional Inventaris

## Peran dan akses

| Peran | Akses aplikasi |
| --- | --- |
| `admin` | Semua halaman dan pengelolaan anggota |
| `inventory` | Data barang, scan/serah-terima, mutasi, laporan, dan membuat pengajuan |
| `approver` | Meninjau pengajuan, mutasi baca, dan laporan |
| `payroll` | Pengajuan/pembayaran baca, mencatat pembayaran/cicilan, dan riwayat anggota baca |
| `member` | Mengajukan dan melihat data miliknya |

Halaman dibatasi berdasarkan profil Supabase. RLS dan RPC di database tetap menjadi otoritas untuk operasi tulis. Akun baru otomatis berperan `member`; administrator harus memberi peran yang sesuai di `profiles` sebelum operasional.

## Identitas barang dan QR

Saat ini satu QR mewakili satu SKU/varian dan stok dicatat sebagai jumlah agregat. Ini cocok untuk chemical dan stok seragam per ukuran. Transaksi barang keluar tetap terhubung ke anggota/pengajuan sehingga pengembalian parsial dapat dicatat.

Jika kantor perlu mengetahui nomor seri setiap unit (misalnya sepatu tertentu dipinjamkan ke siapa), jangan pakai QR SKU bersama. Tahap berikutnya adalah tabel aset/unit individual dengan kode unik per unit dan pencatatan serah-terima berdasarkan aset tersebut.

## Aturan pembayaran yang diterapkan

- Tunai harus ditandai lunas sebelum barang keluar.
- Potong gaji dapat dijadwalkan 2 atau 3 cicilan dan mulai dicatat setelah barang diserahkan.
- Admin/payroll yang dapat mencatat pembayaran; database menolak peran lain.
- Setiap cicilan tercatat menyimpan periode payroll `YYYY-MM`.
- Koreksi pembayaran, pembatalan pengajuan, dan refund belum memiliki alur khusus. Untuk sementara jangan menghapus atau mengubah catatan pembayaran langsung; buat prosedur koreksi yang diaudit sebelum dipakai.

## Uji alur database tanpa data tertinggal

File `supabase/tests/inventory_flow_rollback.sql` menguji pembuatan barang dengan stok awal, tunai, persetujuan, serah barang, pengembalian sebagian, dan dua cicilan payroll dalam satu transaksi lalu melakukan `ROLLBACK`. Script mencari profil berperan `admin` secara otomatis. Jalankan di SQL Editor Supabase setelah seluruh migrasi; pastikan ada akun admin aktif, periksa hasil `PASS`, dan jangan hapus perintah `ROLLBACK`.

## Perangkat dan koneksi

- Pemindaian kamera harus diuji pada perangkat gudang dan browser yang akan digunakan; izin kamera perlu diberikan.
- Jalankan aplikasi di `localhost` atau alamat HTTPS agar akses kamera tersedia. Jika pemindaian otomatis tidak tersedia, masukkan SKU dari label QR secara manual.
- Cetak label QR percobaan pada ukuran sebenarnya dan pastikan kamera dapat membacanya pada jarak kerja.
- Aplikasi menyimpan perubahan melalui Supabase dan belum menyediakan antrean offline. Jangan mencatat transaksi jika perangkat sedang offline; tunggu jaringan pulih dan pastikan notifikasi sukses.

## Cloud, secret, dan pemulihan

- Deploy Next.js ke hosting yang mendukung Next.js dan set `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` di environment hosting.
- Jangan taruh service-role/secret key di browser atau variabel `NEXT_PUBLIC_*`. `.env.local` sudah diabaikan Git.
- Sebelum dipakai harian, administrator perlu mengatur backup database sesuai paket Supabase organisasi dan melakukan uji restore berkala.
- Jalankan migrasi di `supabase/migrations` pada project cloud yang benar; catat project ref dan tanggal migrasi di dokumentasi internal.

## Urutan verifikasi sebelum go-live

1. Jalankan `npx tsc --noEmit --incremental false` dan `npm run build`.
2. Jalankan smoke test SQL rollback di atas.
3. Login dengan akun uji untuk setiap peran dan pastikan halaman di luar akses menampilkan pesan akses terbatas.
4. Di staging, uji satu transaksi UI berlabel `[UJI]` dari barang masuk sampai pengembalian/pembayaran, lalu hapus fixture beserta transaksi lewat prosedur admin yang disetujui.
5. Uji kamera, pencetakan QR, ponsel, desktop, jaringan terputus/pulih, dan prosedur backup/restore.

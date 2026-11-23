# Setup Supabase dan deployment

Aplikasi sudah terhubung ke Supabase untuk autentikasi, data inventaris, pengajuan, pembayaran, cicilan, dan mutasi stok.

## Catatan kelengkapan migrasi

Di salinan proyek ini, `supabase/migrations/202610270001_inventory_core.sql` kosong. Database Supabase yang sudah berjalan tetap menjadi sumber data aktif, tetapi folder ini belum cukup untuk membangun ulang skema inti pada project Supabase baru. Sebelum membuat project baru atau menyiapkan staging, pulihkan SQL skema inti yang benar dari sumber yang dipakai saat setup awal dan cocokkan dengan skema aktif. Jangan menebak atau menjalankan ulang SQL inti pada database yang sudah berisi data.

## Konfigurasi lokal

1. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` di `.env.local` berdasarkan `.env.example`.
2. Jalankan migrasi secara berurutan di SQL Editor project Supabase yang benar:
   - `supabase/migrations/202610270001_inventory_core.sql`
   - `supabase/migrations/202610280001_allow_item_stock_receipt.sql`
   - `supabase/migrations/202611030001_atomic_item_creation.sql`
3. Buat akun admin melalui Authentication → Users. Trigger membuat profil awal dengan peran `member`.
4. Beri peran admin pada profil yang benar menggunakan SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where id = 'UUID-AKUN';
   ```

5. Untuk akun anggota, kaitkan `members.auth_user_id` dengan UUID akun Auth. Tanpa kaitan tersebut, anggota tidak dapat mengajukan atas nama dirinya.
6. Jalankan `npm run dev`, lalu login. Akun yang tidak berperan admin hanya melihat halaman dan menu sesuai haknya.

## Produksi dan keamanan

- Set kedua environment variable publishable di hosting Next.js. Gunakan URL HTTPS.
- Jangan pernah masukkan service-role/secret key ke browser, kode sumber, atau variabel `NEXT_PUBLIC_*`.
- Pastikan seluruh migrasi sudah dijalankan pada project produksi sebelum deploy.
- Konfigurasikan backup database sesuai kebijakan organisasi, tetapkan administrator yang bertanggung jawab, dan uji pemulihan data.
- Kode kamera memerlukan izin kamera dari browser; uji pemindaian pada ponsel yang akan dipakai. Pencarian SKU manual tersedia jika kamera tidak didukung.
- Aplikasi belum memiliki antrean offline. Pastikan koneksi aktif sebelum mencatat transaksi.

Lihat [kesiapan operasional](docs/OPERASIONAL_READINESS.md) dan jalankan smoke test database rollback di `supabase/tests/inventory_flow_rollback.sql` sebelum transaksi nyata.

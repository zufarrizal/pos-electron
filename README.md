# POS Kasir (Electron + SQLite)

Aplikasi kasir desktop berbasis Electron + SQLite untuk restoran/ritel, dengan dukungan transaksi cepat, manajemen produk, riwayat transaksi, laporan Excel, cetak invoice, dan dashboard admin.

## Ringkasan Fitur

### Autentikasi & Role
- Login `admin` dan `pengguna`.
- Otorisasi berbasis role.
- Reset admin tersembunyi di halaman login dengan shortcut `Ctrl + Shift + P`.
- Reset admin berbasis `users.id = 1` (otomatis set username `ADMIN`, password `7890`, role `admin`).

### Produk
- CRUD produk: SKU, nama, harga, stok.
- Pencarian SKU/nama di tabel produk.
- Seed otomatis 50 menu Indonesia (SKU `RST-`) jika tabel produk kosong.
- Produk stok `0` tidak ditampilkan pada picker/rekomendasi transaksi.

### Transaksi
- Pencarian produk via SKU/nama + daftar pilihan produk scrollable.
- Klik item pada list/panel rekomendasi menambah qty otomatis.
- Qty bisa diedit langsung di tabel keranjang.
- Metode pembayaran: `Tunai` / `QRIS`.
- Nomor invoice format: `INV/YY/MM/DD/xxxxx`.
- Tombol cetak invoice tersedia setelah checkout.
- Template cetak invoice dioptimalkan untuk printer thermal `80mm`.

### Riwayat Transaksi
- Filter: `Harian` (default), `Semua`, `Per Tanggal`, `Per Bulan`.
- Ringkasan metrik:
  - Jumlah Transaksi
  - Total Penjualan
  - Total Pembayaran
  - Total Kembalian
  - Total Tunai
  - Total QRIS
- Aksi riwayat berbasis ikon.
- Tombol `Lihat` untuk melihat rincian item produk yang dibeli per transaksi.
- Finalisasi transaksi (`Selesai`) untuk lock edit user non-admin.
- Admin tetap dapat edit transaksi final.
- Hapus riwayat khusus admin.
- Cetak invoice dari tabel riwayat.
- Export Excel sesuai filter aktif.

### Dashboard Admin
- KPI harian/mingguan/bulanan:
  - Total Transaksi
  - Total Pendapatan
  - Total Produk Terjual
- KPI global:
  - Total User
  - Total Produk
  - Total Produk Tersedia
  - Total Produk Kosong
- Grafik pendapatan (kurva) dengan mode `Harian`, `Mingguan`, `Bulanan`.
- Default awal grafik pendapatan: `Mingguan`.
- Best seller list dengan filter periode `Harian/Mingguan/Bulanan/Tahunan`.
- Default awal filter best seller: `Mingguan`.
- Limit best seller: `5`, `10`, `20`, `50`, `100`.

### UI & Utilitas
- Tab terpisah: Produk, Transaksi, Riwayat, Pengguna, Pengaturan, Dashboard (admin).
- Tab admin **Audit Log** untuk melihat jejak aktivitas user (login, CRUD, transaksi, pengaturan).
- Fitur **Backup DB** dan **Restore DB** langsung dari tab Pengaturan (admin).
- Dark mode / light mode switch.
- Fullscreen toggle.
- Konfirmasi hapus/finalisasi dengan modal.
- Tabel bersifat responsif: mengikuti jumlah data, lalu scroll internal saat mencapai batas tinggi layar.

## Akun Default

- Admin: `ADMIN / 7890`
- User: `kasir / 1234`

## Teknologi

- Electron `40.4.1`
- better-sqlite3
- xlsx

## Struktur Proyek

```text
pos-electron/
|-- main.js
|-- package.json
|-- src/
|   |-- db.js
|   |-- preload.js
|   |-- renderer.js
|   |-- renderer_modules/
|   |   |-- shared.js
|   |   |-- render.js
|   |   |-- services.js
|   |   `-- events.js
|   |-- index.html
|   `-- styles.css
`-- scripts/
    |-- seed_restaurant_products.js
    `-- reset_data_keep_users.js
```

## Instalasi & Menjalankan

```bash
cd C:\Users\Admin\Documents\Github\pos-electron
npm install
npm start
```

## Build EXE (Windows)

Perintah standar:

```bash
npm run dist
```

Jika PowerShell memblokir `npm.ps1`, gunakan:

```bash
cmd /c npm.cmd run dist
```

Jika gagal terkait `winCodeSign`/symlink privilege, gunakan:

```bash
npx electron-builder --win nsis --config.win.signAndEditExecutable=false
```

Output:
- Installer: `dist/POS-Kasir-Setup-1.0.0.exe`
- Portable unpacked: `dist/win-unpacked/POS Kasir.exe`

## Cetak Invoice Thermal

- Format struk default: thermal `80mm`.
- Layout cetak dibuat compact (font kecil, margin minim) untuk kasir/restoran.
- Cetak dapat dilakukan dari:
  - notifikasi hasil checkout,
  - tombol print di tabel riwayat transaksi.
- Jika hasil cetak belum pas:
  1. Buka dialog print.
  2. Pilih printer thermal yang benar.
  3. Pastikan paper size di driver printer diset ke `80mm`.

## Lokasi Database

SQLite file:

`%APPDATA%\pos-electron\pos.sqlite`

## Backup & Restore Database (UI)

Dilakukan dari tab **Pengaturan Aplikasi** (khusus admin).

### Backup DB
1. Buka tab `Pengaturan`.
2. Klik tombol `Backup DB`.
3. Pilih lokasi file backup (`.sqlite` / `.db`), lalu simpan.

### Restore DB
1. Buka tab `Pengaturan`.
2. Klik tombol `Restore DB`.
3. Pilih file backup database.
4. Konfirmasi restore.
5. Aplikasi akan restart otomatis setelah restore selesai.

Catatan:
- Restore akan menimpa data database aktif.
- Disarankan lakukan backup sebelum restore.

## Skrip Utilitas

Seed data produk restoran:

```bash
npx electron scripts/seed_restaurant_products.js
```

Reset seluruh data transaksi/produk (user tetap):

```bash
npx electron scripts/reset_data_keep_users.js
```

## Hak Akses

### Admin
1. Akses dashboard admin.
2. Kelola produk (tambah/ubah/hapus, sesuai validasi relasi transaksi).
3. Kelola transaksi (buat/ubah/finalisasi/hapus riwayat transaksi).
4. Edit transaksi final (yang sudah `Selesai`).
5. Kelola user (tambah/ubah/hapus, kecuali `id=1`).
6. Akses tab Audit Log aktivitas user.
7. Kelola pengaturan aplikasi (nama & deskripsi).
8. Backup dan restore database dari UI Pengaturan.
9. Cetak invoice dan export laporan Excel.
10. Reset password admin ke default (`ADMIN/7890`) via shortcut login.

### Pengguna
1. Akses tab Produk, Transaksi, dan Riwayat.
2. Kelola produk (tambah/ubah/hapus) sesuai validasi data.
3. Buat transaksi baru dan ubah transaksi yang belum final.
4. Finalisasi transaksi (`Selesai`) untuk mengunci transaksi.
5. Lihat riwayat transaksi sesuai filter yang tersedia.
6. Cetak invoice dan export riwayat transaksi ke Excel.
7. Tidak bisa menghapus riwayat transaksi.
8. Tidak bisa mengelola user.
9. Tidak bisa akses dashboard admin, audit log, dan pengaturan aplikasi.
10. Tidak bisa backup/restore database.

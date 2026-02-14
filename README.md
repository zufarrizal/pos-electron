# POS Kasir (Electron + SQLite)

Aplikasi kasir desktop berbasis Electron + SQLite untuk restoran/ritel, dengan dukungan transaksi cepat, manajemen produk, riwayat transaksi, laporan Excel, cetak invoice, dan dashboard admin.

## Image Preview 

<p align="center">
  <img src="./image%20preview/Screenshot%202026-02-14%20150539.png" alt="Preview 1" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150552.png" alt="Preview 2" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150555.png" alt="Preview 3" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150557.png" alt="Preview 4" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150559.png" alt="Preview 5" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150602.png" alt="Preview 6" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150604.png" alt="Preview 7" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150612.png" alt="Preview 8" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150621.png" alt="Preview 9" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150623.png" alt="Preview 10" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150625.png" alt="Preview 11" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150627.png" alt="Preview 12" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150630.png" alt="Preview 13" width="24%" />
  <img src="./image%20preview/Screenshot%202026-02-14%20150631.png" alt="Preview 14" width="24%" />
</p>

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
- Best seller list dengan filter periode `Harian/Mingguan/Bulanan/Tahunan`.
- Limit best seller: `5`, `10`, `20`, `50`, `100`.

### UI & Utilitas
- Tab terpisah: Produk, Transaksi, Riwayat, Pengguna, Pengaturan, Dashboard (admin).
- Dark mode / light mode switch.
- Fullscreen toggle.
- Konfirmasi hapus/finalisasi dengan modal.

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
2. Kelola user (tambah/ubah/hapus, kecuali `id=1`).
3. Kelola pengaturan aplikasi.
4. Hapus riwayat transaksi.
5. Edit transaksi final.

### Pengguna
1. Kelola produk dan transaksi sesuai menu yang ditampilkan.
2. Tidak bisa menghapus riwayat.
3. Tidak bisa menghapus user.

## Troubleshooting

### Tidak bisa login
1. Pastikan jalankan dari folder `pos-electron` (bukan folder di atasnya).
2. Coba reset admin dari login:
   - Tekan `Ctrl + Shift + P`
   - Klik `Atur Ulang Admin`
   - Login lagi dengan `ADMIN / 7890`
3. Jika masih gagal, tutup aplikasi lalu cek/backup database di `%APPDATA%\pos-electron\pos.sqlite`.

### Error `better-sqlite3` beda Node module version

```bash
npm install
npm run rebuild
```

### Riwayat terasa berat
- Gunakan filter default `Harian`.
- Gunakan export Excel untuk analisis data besar.

## Catatan Keamanan

Saat ini password masih plain text untuk penggunaan lokal/offline. Untuk produksi, disarankan:
- Hash password (mis. `bcrypt`).
- Tambah audit log aktivitas user.
- Tambah backup/restore DB dari UI.

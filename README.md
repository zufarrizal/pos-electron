# POS Kasir (Electron + SQLite)

Aplikasi kasir desktop berbasis Electron dan SQLite untuk operasional restoran/ritel skala kecil-menengah. Proyek ini mendukung manajemen produk, transaksi kasir, riwayat transaksi, cetak invoice, ekspor Excel, serta dasbor admin.

## Gambaran Umum

POS Kasir dirancang untuk penggunaan lokal (offline-first) dengan database SQLite. Fokus utama aplikasi adalah:

- Proses transaksi cepat dan stabil.
- Kontrol akses berdasarkan peran (`admin` dan `pengguna`).
- Pelacakan penjualan dan ringkasan performa bisnis.
- Kemudahan backup/restore melalui file database lokal.

## Fitur Utama

### 1. Autentikasi dan Otorisasi
- Login multi-peran: `admin` dan `pengguna`.
- Hak akses dibatasi per peran.
- Reset akun admin via shortcut login (`Ctrl + Shift + P`) berbasis `users.id = 1`.

### 2. Manajemen Produk
- CRUD produk (SKU, nama, harga, stok).
- Pencarian produk cepat pada tabel produk.
- Validasi stok saat transaksi.

### 3. Transaksi Kasir
- Input produk via pencarian SKU/nama.
- Daftar rekomendasi produk dengan filter periode:
  - Harian, Mingguan, Bulanan, Tahunan.
- Filter jumlah rekomendasi:
  - `4`, `8`, `12`, `16`, `20` teratas.
- Klik produk pada daftar/rekomendasi langsung menambah item ke keranjang (`qty +1`).
- Kuantitas item di tabel transaksi dapat diubah langsung.
- Metode pembayaran: `Tunai` dan `QRIS`.
- Cetak invoice langsung setelah pembayaran.

### 4. Riwayat Transaksi
- Filter riwayat:
  - Harian, Semua, Per Tanggal, Per Bulan.
- Ringkasan metrik riwayat:
  - Jumlah transaksi, total penjualan, total pembayaran, total kembalian, total tunai, total QRIS.
- Edit transaksi (tergantung status/finalisasi dan role).
- Finalisasi transaksi (`Selesai`) untuk mengunci transaksi.
- Hapus riwayat transaksi khusus admin.
- Cetak invoice dari riwayat.
- Ekspor riwayat ke Excel sesuai filter aktif.

### 5. Dasbor Admin
- KPI transaksi, pendapatan, dan produk terjual (harian/mingguan/bulanan).
- Total pengguna.
- Total produk (tersedia/kosong).
- Grafik pendapatan (kurva): harian/mingguan/bulanan.
- Produk terlaris dengan:
  - filter periode (harian/mingguan/bulanan/tahunan),
  - jumlah top produk (`5/10/20/50/100`).

### 6. Pengaturan Aplikasi
- Ubah nama aplikasi dan deskripsi aplikasi (admin).
- Mode layar penuh.

## Akun Default

- `ADMIN / 7890` (role: `admin`)
- `kasir / 1234` (role: `pengguna`)

## Format Nomor Invoice

Format:

`INV/YY/MM/DD/xxxxx`

Contoh:

`INV/26/02/14/00001`

Nomor urut `xxxxx` di-reset setiap hari.

## Teknologi

- Electron
- better-sqlite3 (SQLite)
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

## Persyaratan Sistem

- Node.js LTS
- npm
- Windows/macOS/Linux (fokus pengujian: Windows)

## Instalasi dan Menjalankan Aplikasi

```bash
cd C:\Users\Admin\Documents\Github\pos-electron
npm install
npm start
```

## Lokasi Database

Database SQLite disimpan di:

`%APPDATA%\pos-electron\pos.sqlite`

## Skrip Utilitas

### Seed produk restoran
```bash
npx electron scripts/seed_restaurant_products.js
```

### Hapus semua data kecuali pengguna
```bash
npx electron scripts/reset_data_keep_users.js
```

## Seed Otomatis Produk

Jika tabel produk kosong, aplikasi otomatis menambahkan 50 menu restoran Indonesia dengan prefix SKU `RST-`.

## Aturan Akses

### Admin
1. Akses dasbor.
2. Kelola pengguna.
3. Kelola pengaturan aplikasi.
4. Hapus riwayat transaksi.
5. Edit transaksi final.
6. Atur ulang sandi admin via shortcut login.

### Pengguna
1. Melakukan transaksi kasir.
2. Mengelola produk/transaksi sesuai menu tersedia.
3. Tidak dapat menghapus riwayat transaksi.

## Troubleshooting

### 1. Shortcut reset admin tidak muncul
- Pastikan fokus berada di halaman masuk.
- Tekan `Ctrl + Shift + P`.

### 2. Riwayat terasa berat
- Gunakan mode filter `Harian` (default) untuk beban data lebih ringan.

### 3. Error modul native `better-sqlite3`
- Jalankan ulang instalasi dependensi di folder proyek:
```bash
npm install
npm run rebuild
```

## Catatan Pengembangan

- Frontend menggunakan ES Module (`<script type="module">`).
- Kode renderer dipisah per tanggung jawab (`shared`, `render`, `services`, `events`) untuk kemudahan maintenance.

## Rekomendasi Lanjutan

- Tambahkan hashing password (saat ini masih plain text untuk kebutuhan lokal/dev).
- Tambahkan backup/restore database dari UI.
- Tambahkan unit test untuk fungsi transaksi dan perhitungan laporan.

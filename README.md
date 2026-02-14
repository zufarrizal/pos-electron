# POS Kasir Electron + SQLite

Aplikasi POS/kasir desktop berbasis Electron + SQLite dengan fitur transaksi, manajemen produk/pengguna, dasbor admin, cetak invoice, dan ekspor riwayat ke Excel.

## Ringkasan Fitur

- Login multi-peran: `admin` dan `pengguna`
- Tab terpisah: Dasbor, Produk, Transaksi, Riwayat, Pengguna, Pengaturan
- CRUD Produk
- CRUD Pengguna (khusus admin)
- Transaksi kasir dengan pencarian SKU/nama, daftar pilihan produk yang bisa di-scroll, dan validasi stok
- Rekomendasi produk di tab Transaksi (klik untuk pilih cepat), dengan filter periode `Harian/Mingguan/Bulanan/Tahunan`
- Filter jumlah rekomendasi transaksi: `4/8/12/16/20 Teratas`
- Klik produk di daftar atau rekomendasi akan langsung menambah kuantitas (`qty +1`) ke keranjang
- Kuantitas (`qty`) item di tabel transaksi bisa diubah langsung
- Metode pembayaran: `Tunai` dan `QRIS`
- Edit transaksi dari riwayat
- Finalisasi transaksi (`Selesai`) untuk mengunci transaksi
- Admin tetap bisa edit/hapus riwayat transaksi
- Cetak invoice dari riwayat transaksi
- Cetak invoice langsung dari notifikasi pembayaran
- Filter riwayat transaksi: Harian, Semua, Per Tanggal, Per Bulan
- Tombol reset filter riwayat kembali ke mode Harian
- Export riwayat transaksi ke Excel
- Ringkasan riwayat: jumlah transaksi, total penjualan, total pembayaran, total kembalian, total tunai, total QRIS
- Dasbor admin:
1. Total transaksi harian/mingguan/bulanan
2. Total pendapatan harian/mingguan/bulanan
3. Total produk terjual harian/mingguan/bulanan
4. Total pengguna
5. Total produk (tersedia/kosong)
6. Grafik pendapatan (harian/mingguan/bulanan) bentuk kurva
7. Produk terlaris dengan filter periode `Harian/Mingguan/Bulanan/Tahunan`
8. Filter jumlah produk terlaris: `5/10/20/50/100 Teratas`
- Mode layar penuh
- Pengaturan nama & deskripsi aplikasi (admin)

## Akun Default

1. `ADMIN / 7890` (role: `admin`)
2. `kasir / 1234` (role: `pengguna`)

## Shortcut Reset Admin (Halaman Login)

- Tekan `Ctrl + Shift + P` di halaman masuk untuk menampilkan tombol atur ulang admin.
- Tombol reset akan mengatur ulang akun admin berdasarkan `users.id = 1`.
- Hasil reset:
1. `username` user id 1 menjadi `ADMIN`
2. `password` user id 1 menjadi `7890`
3. `role` user id 1 menjadi `admin`

## Format Invoice

Format invoice saat ini:

`INV/YY/MM/DD/xxxxx`

Contoh:

`INV/26/02/14/00001`

Nomor urut `xxxxx` di-reset per hari.

## Seed Data Produk

Saat database produk kosong, sistem akan otomatis mengisi **50 menu restoran Indonesia** dengan prefix SKU `RST-`.

## Tech Stack

- Electron
- better-sqlite3 (SQLite)
- xlsx (export Excel)

## Struktur Project

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

## Cara Menjalankan

Pastikan menjalankan command di folder project yang berisi `package.json`.

```bash
cd C:\Users\Admin\Documents\Github\pos-electron
npm install
npm start
```

## Lokasi Database

Database SQLite disimpan di:

`%APPDATA%\pos-electron\pos.sqlite`

## Script Utilitas

- Seed produk restoran:
```bash
npx electron scripts/seed_restaurant_products.js
```

- Hapus semua data kecuali user:
```bash
npx electron scripts/reset_data_keep_users.js
```

## Aturan Akses

- `admin`:
1. Akses dashboard
2. Kelola pengguna
3. Kelola pengaturan aplikasi
4. Hapus riwayat transaksi
5. Edit transaksi yang sudah final
6. Atur ulang kata sandi ADMIN ke `7890` (hanya dari shortcut halaman masuk)

- `pengguna`:
1. Transaksi kasir
2. Kelola produk/transaksi sesuai menu yang tersedia
3. Tidak bisa hapus riwayat transaksi

## Catatan

- Jika data produk kosong setelah reset, seed akan otomatis masuk saat aplikasi dijalankan.
- Export Excel mengikuti filter riwayat yang aktif.
- Riwayat transaksi default menampilkan data harian untuk performa lebih ringan.
- Jika shortcut reset admin tidak muncul, pastikan fokus ada di jendela masuk lalu tekan `Ctrl + Shift + P` sekali lagi.
- Frontend renderer memakai ES Module (`<script type="module">`) dan sudah dipisah per tanggung jawab agar lebih mudah maintenance.

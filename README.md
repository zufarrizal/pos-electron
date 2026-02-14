# POS Kasir Electron + SQLite

Aplikasi POS/kasir desktop berbasis Electron + SQLite dengan fitur transaksi, manajemen produk/user, dashboard admin, dan export riwayat ke Excel.

## Ringkasan Fitur

- Login multi-role: `admin` dan `user`
- Tab terpisah: Dashboard, Produk, Transaksi, Riwayat, Users, Pengaturan
- CRUD Produk
- CRUD Users (khusus admin)
- Transaksi kasir dengan pencarian SKU/nama, daftar pilihan produk yang bisa di-scroll, dan validasi stok
- Edit transaksi dari riwayat
- Finalisasi transaksi (`Selesai`) untuk mengunci transaksi
- Admin tetap bisa edit/hapus riwayat transaksi
- Print invoice dari riwayat transaksi
- Print invoice langsung dari notifikasi checkout
- Filter riwayat transaksi: Harian, Semua, Per Tanggal, Per Bulan
- Tombol reset filter riwayat kembali ke mode Harian
- Export riwayat transaksi ke Excel
- Dashboard admin:
1. Total transaksi harian/mingguan/bulanan
2. Total pendapatan harian/mingguan/bulanan
3. Total produk terjual harian/mingguan/bulanan
4. Total user
5. Total produk (tersedia/kosong)
6. Grafik pendapatan (harian/mingguan/bulanan)
7. Best produk terlaris (Top 5/10/20/50/100)
- Fullscreen toggle
- Pengaturan nama & deskripsi aplikasi (admin)

## Akun Default

1. `ADMIN / 7890` (role: `admin`)
2. `kasir / 1234` (role: `user`)

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
├─ main.js
├─ package.json
├─ src/
│  ├─ db.js
│  ├─ preload.js
│  ├─ renderer.js
│  ├─ index.html
│  └─ styles.css
└─ scripts/
   ├─ seed_restaurant_products.js
   └─ reset_data_keep_users.js
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
2. Kelola user
3. Kelola pengaturan aplikasi
4. Hapus riwayat transaksi
5. Edit transaksi yang sudah final
6. Reset password ADMIN ke `7890`

- `user`:
1. Transaksi kasir
2. Kelola produk/transaksi sesuai menu yang tersedia
3. Tidak bisa hapus riwayat transaksi

## Catatan

- Jika data produk kosong setelah reset, seed akan otomatis masuk saat aplikasi dijalankan.
- Export Excel mengikuti filter riwayat yang aktif.
- Riwayat transaksi default menampilkan data harian untuk performa lebih ringan.

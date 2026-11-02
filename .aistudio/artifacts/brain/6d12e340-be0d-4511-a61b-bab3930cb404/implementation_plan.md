# Rencana Implementasi: Fitur Update Aplikasi via GitHub di Pengaturan, Dokumentasi `README.md`, & Konfigurasi Docker

Rencana ini menggabungkan penambahan fitur **Update Aplikasi via GitHub** langsung di halaman **Pengaturan** serta pembuatan dokumentasi **`README.md`** dan berkas kontainerisasi **Docker** (`Dockerfile`, `docker-compose.yml`, `.dockerignore`).

---

## 1. Fitur "Update Aplikasi via GitHub" di Menu Pengaturan
Memungkinkan pengguna/admin memperbarui aplikasi langsung dari repositori GitHub melalui antarmuka web tanpa kehilangan data pelanggan, tagihan, pengeluaran, maupun logo di folder `/data`.

### A. Backend Endpoint (`server.ts`)
1. **Penyimpanan Konfigurasi GitHub di `AppSettings` (`src/types.ts` & `server.ts`)**:
   - Menambahkan field `github_repo_url` (contoh: `https://github.com/username/simple-billing-isp.git`) dan `github_branch` (default: `main`).
2. **`GET /api/system/github-status`**:
   - Membaca informasi versi lokal saat ini menggunakan perintah Git (`git rev-parse --short HEAD`, `git log -1 --format="%s (%ci)"`, `git branch --show-current`, dan `git remote get-url origin`).
   - Jika folder belum memiliki `.git`, menampilkan status bahwa repositori Git belum diinisialisasi dan siap dihubungkan ke URL GitHub yang diatur.
3. **`POST /api/system/github-check` (Cek Pembaruan dari GitHub)**:
   - Menyimpan/menyinkronkan `remote origin` dengan `github_repo_url` (dan menginisialisasi `git init` jika belum ada `.git`).
   - Menjalankan `git fetch origin <branch>` dan memeriksa jumlah *commit* terbaru yang belum terpasang (`git rev-list HEAD..origin/<branch> --count`) beserta daftar *changelog* (`git log HEAD..origin/<branch> --oneline -n 10`).
4. **`POST /api/system/github-update` (Tarik & Terapkan Update)**:
   - Menjaga folder `/data` (`db.json` dan `uploads/`) tetap aman dan dikecualikan dari perubahan Git.
   - Menjalankan `git pull origin <branch> --autostash` (atau `git reset --hard origin/<branch>` terhadap kode sumber aplikasi), dilanjutkan dengan `npm install --no-audit --no-fund` dan `npm run build` (jika berjalan di mode produksi).
   - Mengembalikan log eksekusi lengkap ke layar Pengaturan serta informasi versi *commit* terbaru setelah update selesai.

### B. Antarmuka Pengguna (`src/components/SettingsView.tsx` & `src/api.ts`)
- Menambahkan kartu **"Update Aplikasi via GitHub"** di halaman **Pengaturan**:
  - Menampilkan **Status Versi Saat Ini** (Hash Commit, Branch Aktif, Waktu Commit Terakhir).
  - Input **URL Repositori GitHub** (`https://github.com/...`) dan **Branch** (`main` / `master`).
  - Tombol **"Cek Pembaruan"** untuk memeriksa apakah ada versi baru di GitHub beserta tampilan daftar *commit* terbaru (*changelog*).
  - Tombol **"Update Sekarang dari GitHub"** dengan dialog konfirmasi dan kotak *output log* terminal untuk melihat hasil proses *git pull* secara transparan.

---

## 2. Berkas Kontainerisasi Docker Siap Pakai
1. **`/Dockerfile`**:
   - Menggunakan base image `node:22-alpine` dan menginstal paket **`git`** (`apk add --no-cache git`) agar fitur **Update Aplikasi via GitHub** di menu Pengaturan juga berfungsi di dalam kontainer Docker.
   - Menginstal dependensi, menjalankan `npm run build`, dan menjalankan server pada port `3000`.
   - Menyiapkan `/app/data` sebagai *volume* persisten.
2. **`/docker-compose.yml`**:
   - Konfigurasi layanan `simple-billing-isp` dengan port `3000:3000`, `restart: unless-stopped`, dan *bind mount* `./data:/app/data`.
3. **`/.dockerignore`**:
   - Mengecualikan `node_modules`, `dist`, dan `.aistudio`.

---

## 3. Struktur Lengkap `README.md`
1. **Deskripsi Aplikasi & Fitur Utama** (Dashboard, Pelanggan, Tagihan Anti-Duplikat, Cetak Invoice A4 & Struk 58mm/80mm, Monitoring MikroTik Real-Time, Backup/Restore `.XLSX`, dan Update Aplikasi via GitHub).
2. **Panduan Instalasi di Linux (Secara Native)** + **PM2** & **Systemd Service**.
3. **Panduan Instalasi melalui Docker & Docker Compose (Linux & Windows)**.
4. **Panduan Instalasi di Windows (Secara Native)** + **PM2 Windows Startup**.
5. **Panduan Update Aplikasi melalui Menu Pengaturan (GitHub) maupun CLI**.
6. **Panduan Persiapan Port & User API di Router MikroTik (Winbox & Terminal)**.
7. **Panduan Reverse Proxy Nginx (HTTPS SSL) & Cloudflare Tunnel**.

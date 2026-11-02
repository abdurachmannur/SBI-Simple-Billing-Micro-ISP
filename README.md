# Simple Billing Mini ISP (`v1.2.0`)

Aplikasi **Manajemen Pelanggan, Tagihan WiFi Bulanan, Pengingat WhatsApp, Cetak Struk Termal, & Monitoring Router MikroTik Real-Time** yang dirancang khusus untuk kebutuhan **RT/RW Net dan Mini ISP** di Indonesia.

---

## Daftar Isi
1. [Deskripsi & Fitur Utama](#1-deskripsi--fitur-utama)
2. [Arsitektur Teknologi & Keamanan Anti-CVE / Anti-RCE](#2-arsitektur-teknologi--keamanan-anti-cve--anti-rce)
3. [Sistem Penomoran Versi (`version.json`) & Update via GitHub](#3-sistem-penomoran-versi-versionjson--update-via-github)
4. [Cara Instalasi di Linux (Secara Native)](#4-cara-instalasi-di-linux-secara-native)
   - [Menjalankan di Background dengan PM2 (Direkomendasikan)](#41-menjalankan-di-background-dengan-pm2-direkomendasikan)
   - [Menjalankan di Background dengan Systemd Service](#42-menjalankan-di-background-dengan-systemd-service)
5. [Cara Instalasi Menggunakan Docker & Docker Compose (Linux & Windows)](#5-cara-instalasi-menggunakan-docker--docker-compose-linux--windows)
6. [Cara Instalasi di Windows (Secara Native)](#6-cara-instalasi-di-windows-secara-native)
   - [Menjalankan di Background pada Windows (PM2 Startup)](#61-menjalankan-di-background-pada-windows-pm2-startup)
7. [Panduan Persiapan Port & User API di Router MikroTik](#7-panduan-persiapan-port--user-api-di-router-mikrotik)
8. [Panduan Reverse Proxy Nginx (HTTPS SSL) & Cloudflare Tunnel](#8-panduan-reverse-proxy-nginx-https-ssl--cloudflare-tunnel)
9. [Struktur Penyimpanan Data & Backup](#9-struktur-penyimpanan-data--backup)

---

## 1. Deskripsi & Fitur Utama

**Simple Billing Mini ISP** memudahkan pemilik RT/RW Net dan Mini ISP dalam mengelola operasional harian dari satu dasbor web yang cepat, ringan, dan responsif (nyaman dibuka di HP Android maupun Desktop):

- **Dashboard Ringkasan Finansial**: Pantau total pelanggan aktif, pendapatan bulan berjalan, persentase pelanggan lunas vs belum bayar, total pengeluaran operasional, serta estimasi laba bersih.
- **Manajemen Pelanggan & Data Teknis**:
  - Simpan nama, nomor WhatsApp, alamat, tanggal jatuh tempo (`1–31`), dan status pelanggan (`Aktif` / `Nonaktif`).
  - Data teknis lengkap: **User PPPoE / IP Statis**, **Lokasi ODP / Port / Redaman (dBm)**, serta **Link Koordinat Google Maps** yang bisa diklik langsung oleh teknisi lapangan.
- **Tagihan Bulanan & Filter Menunggak**:
  - Generate tagihan bulanan otomatis untuk seluruh pelanggan aktif.
  - Filter cepat: **Semua**, **Lunas**, **Belum Bayar**, dan **Menunggak (Lewat Jatuh Tempo)**.
  - Kirim pengingat tagihan & konfirmasi lunas langsung ke **WhatsApp** pelanggan dengan satu klik (pesan otomatis terisi dari template yang dapat dikustomisasi).
- **Cetak Invoice A4 & Struk Termal Bluetooth/USB (`58mm` & `80mm`)**:
  - Pilihan format cetak langsung pada modal Invoice: **Standar A4**, **Struk Termal 58mm**, atau **Struk Termal 80mm**.
  - Unduh invoice sebagai gambar **PNG** atau dokumen **PDF** untuk dikirim via WhatsApp.
- **Riwayat Pembayaran 12 Bulan**: Pantau histori pembayaran pelanggan selama 1 tahun penuh beserta tanggal bayar dan metode pembayaran.
- **Monitoring Pelanggan MikroTik Real-Time (RouterOS API v6 & v7)**:
  - Mendukung gabungan metode **PPPoE Active + Secret**, **Simple Queue**, serta **IP Binding / ARP / Netwatch**.
  - Indikator kesehatan router: **Beban CPU (%)**, **Penggunaan RAM**, **Uptime Router**, **Versi RouterOS**, dan **Board Name**.
  - Pantau status **Online / Offline**, alamat IP, MAC Address, Uptime sesi, serta **Live Traffic Download (Rx) & Upload (Tx)** per pelanggan dengan fitur urutkan (*sort*) berdasarkan pemakaian bandwidth tertinggi.
  - **Tindakan Cepat Langsung dari Aplikasi**:
    - **Isolir / Buka Isolir Pelanggan** (mengubah profile PPPoE ke profile isolir atau menonaktifkan secret/queue sekaligus memutus sesi aktif agar langsung berlaku).
    - **Reset Koneksi PPPoE** (memutus sesi aktif agar router pelanggan melakukan *re-dial* ulang).
- **Backup & Restore Database `.XLSX`**:
  - Ekspor seluruh data (Pelanggan, Paket, Tagihan, Pengeluaran, Pengaturan) ke 1 file Excel (`.xlsx`) multi-sheet.
  - **Restore Data** dari file `.xlsx` kapan saja melalui menu Pengaturan.
- **Sistem Versi (`v1.2.0`) & Update Aplikasi via GitHub**:
  - Cek pembaruan versi aplikasi dan riwayat perubahan (*changelog*) langsung dari menu **Pengaturan**, serta lakukan update otomatis dengan 1 klik tanpa menghapus data pelanggan.

---

## 2. Arsitektur Teknologi & Keamanan Anti-CVE / Anti-RCE

Aplikasi ini dibangun menggunakan ekosistem modern dengan versi paket terbaru untuk memastikan performa tinggi dan keamanan dari celah kerentanan (*Common Vulnerabilities and Exposures* / **CVE**), khususnya celah *Remote Code Execution* (**RCE**):

| Komponen | Teknologi & Versi | Keterangan Keamanan |
| :--- | :--- | :--- |
| **Runtime Server** | **Node.js v22 LTS / v24 Latest** | Menggunakan rilis Node.js terbaru dengan patch keamanan V8 & OpenSSL terkini. |
| **Backend Framework** | **Express + TypeScript (`tsx`)** | Header HTTP diamankan (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`, `x-powered-by` dinonaktifkan). |
| **Frontend UI** | **React 19 + Vite 8 + Tailwind CSS v4** | Bebas dari kerentanan *Server-Side Rendering* (murni SPA + REST API JSON). |
| **Database Persisten** | **JSON Atomic File (`data/db.json`)** | Bebas dari risiko *SQL Injection* karena tidak menggunakan query SQL mentah. |
| **GitHub Updater** | **`node:child_process.execFile`** | **Anti-RCE Hardened**: Mengeksekusi binary `git` dan `npm` secara langsung (`shell: false`) dengan argumen array terpisah serta validasi Regex ketat (`^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+(?:\.git)?$`). Karakter injeksi shell seperti `;`, `|`, `&`, `` ` ``, `$()` ditolak sepenuhnya. |

---

## 3. Sistem Penomoran Versi (`version.json`) & Update via GitHub

Setiap rilis aplikasi memiliki nomor versi resmi (Semantic Versioning) yang tercatat di dalam file **`version.json`** dan **`package.json`** (saat ini **`v1.2.0`**).

### Cara Kerja Update Aplikasi dari Menu Pengaturan:
1. Buka menu **Pengaturan** -> gulir ke bagian **6. Sistem Versi & Update Aplikasi via GitHub**.
2. Masukkan **URL Repository GitHub** (contoh: `https://github.com/username/simple-billing-mini-isp`) dan **Branch** (contoh: `main`).
3. Klik tombol **"Cek Pembaruan"**:
   - Server akan mengambil file `version.json` dari GitHub serta memeriksa commit terbaru menggunakan `git ls-remote`.
   - Aplikasi akan menampilkan perbandingan **Versi Terpasang** vs **Versi Terbaru di GitHub** beserta daftar **Changelog (Perubahan Baru)**.
4. Klik tombol **"Update Sekarang"** jika tersedia versi baru:
   - Aplikasi secara otomatis menjalankan `git fetch`, `git reset --hard origin/<branch>`, `npm install`, dan `npm run build`.
   - **Data 100% Aman**: Folder `/data` (`db.json` dan `uploads/`) dikecualikan di `.gitignore`, sehingga proses update kode tidak akan pernah menghapus data pelanggan atau tagihan Anda.

### Cara Menaikkan Versi Saat Anda Mengubah Kode di GitHub:
Setiap kali Anda melakukan penambahan fitur atau perbaikan bug pada repository GitHub Anda, ubah nilai `"version"` pada file **`version.json`** dan **`package.json`** (misalnya dari `"1.2.0"` menjadi `"1.3.0"`), tambahkan catatan pada bagian `"changelog"` di `version.json`, lalu lakukan `git commit` dan `git push`.

---

## 4. Cara Instalasi di Linux (Secara Native)

Panduan ini berlaku untuk **Ubuntu 20.04 / 22.04 / 24.04 LTS**, **Debian 11 / 12**, **CentOS / AlmaLinux / Rocky Linux**, maupun perangkat **Armbian / STB / Raspberry Pi**.

### Langkah 1: Install Node.js 22 LTS & Git
Jalankan perintah berikut di terminal Linux Anda:

```bash
# Update daftar paket sistem & install curl serta git
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Tambahkan repository resmi NodeSource untuk Node.js 22 LTS terbaru
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Install Node.js & npm
sudo apt install -y nodejs

# Verifikasi versi Node.js (pastikan v22.x.x) dan Git
node -v
npm -v
git --version
```

### Langkah 2: Clone Repository & Build Aplikasi
```bash
# Pindah ke direktori /opt atau home user Anda
cd /opt

# Clone repository aplikasi dari GitHub Anda
sudo git clone https://github.com/username-anda/simple-billing-mini-isp.git
sudo chown -R $USER:$USER /opt/simple-billing-mini-isp
cd /opt/simple-billing-mini-isp

# Install seluruh dependensi
npm install

# Build tampilan frontend produksi
npm run build
```

### Langkah 3: Uji Coba Jalankan Aplikasi
```bash
NODE_ENV=production PORT=3000 npx tsx server.ts
```
Buka browser dan akses `http://<IP-Server-Linux>:3000`. Tekan `Ctrl + C` jika sudah berhasil tampil, lalu lanjutkan ke langkah menjalankan di background di bawah ini.

---

### 4.1. Menjalankan di Background dengan PM2 (Direkomendasikan)

**PM2** menjaga aplikasi tetap berjalan 24/7, otomatis *restart* setelah Anda melakukan **Update via GitHub** dari menu Pengaturan, dan otomatis menyala saat server *reboot*.

```bash
# 1. Install PM2 secara global
sudo npm install -g pm2

# 2. Masuk ke folder aplikasi
cd /opt/simple-billing-mini-isp

# 3. Jalankan aplikasi di background menggunakan PM2
NODE_ENV=production PORT=3000 pm2 start "npx tsx server.ts" --name "billing-isp"

# 4. Simpan daftar proses PM2
pm2 save

# 5. Aktifkan auto-start saat server Linux menyala (booting)
pm2 startup
# (Salin dan jalankan perintah 'sudo env PATH=...' yang muncul di layar Anda, lalu ketik 'pm2 save' sekali lagi)
```

**Perintah Berguna PM2:**
- Cek status aplikasi: `pm2 status`
- Lihat log aplikasi: `pm2 logs billing-isp`
- Restart aplikasi: `pm2 restart billing-isp`

---

### 4.2. Menjalankan di Background dengan Systemd Service (Alternatif Tanpa PM2)

Jika Anda lebih memilih menggunakan **Systemd** bawaan Linux:

```bash
sudo nano /etc/systemd/system/billing-isp.service
```

Tempelkan konfigurasi berikut (sesuaikan `User` dan `WorkingDirectory` jika berbeda):

```ini
[Unit]
Description=Simple Billing Mini ISP Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/simple-billing-mini-isp
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=TZ=Asia/Jakarta
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Simpan file (`Ctrl+O`, `Enter`, `Ctrl+X`), lalu aktifkan service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable billing-isp
sudo systemctl start billing-isp

# Cek status service
sudo systemctl status billing-isp
```

---

## 5. Cara Instalasi Menggunakan Docker & Docker Compose (Linux & Windows)

Proyek ini sudah dilengkapi dengan **`Dockerfile`** (berbasis `node:22-alpine` dengan patch keamanan OS terbaru) dan **`docker-compose.yml`**.

### Prasyarat:
- **Linux**: Sudah terpasang Docker Engine & Docker Compose plugin (`sudo apt install docker.io docker-compose-v2`).
- **Windows**: Sudah terpasang **Docker Desktop for Windows**.

### Langkah Menjalankan dengan Docker Compose:

```bash
# 1. Masuk ke folder proyek
cd simple-billing-mini-isp

# 2. Build image dan jalankan container di background
docker compose up -d --build
```

Aplikasi akan langsung berjalan di **`http://localhost:3000`** (atau `http://<IP-Server>:3000`).

### Keamanan Data pada Docker:
Pada `docker-compose.yml`, folder `./data` di komputer/server host telah di-*mount* ke `/app/data` di dalam container (`./data:/app/data`). Seluruh database `db.json`, logo, dan bukti bayar tersimpan aman di luar container.

### Perintah Operasional Docker Compose:
- Melihat log container: `docker compose logs -f`
- Merestart container: `docker compose restart`
- Memperbarui & rebuild container: `docker compose up -d --build`
- Menghentikan container: `docker compose down`

---

## 6. Cara Instalasi di Windows (Secara Native)

Cocok dijalankan pada mini PC Windows 10 / Windows 11 atau Windows Server yang menyala di kantor RT/RW Net Anda.

### Langkah 1: Install Node.js & Git for Windows
1. Unduh dan install **Node.js v22 LTS (Windows Installer `.msi`)** dari [https://nodejs.org](https://nodejs.org). Pastikan opsi *"Automatically install the necessary tools"* atau *Add to PATH* tercentang.
2. Unduh dan install **Git for Windows** dari [https://git-scm.com/download/win](https://git-scm.com/download/win).

### Langkah 2: Clone & Build Aplikasi
Buka **PowerShell** atau **Command Prompt (CMD)** sebagai Administrator:

```powershell
# Pindah ke drive C:\
cd C:\

# Clone repository dari GitHub
git clone https://github.com/username-anda/simple-billing-mini-isp.git
cd C:\simple-billing-mini-isp

# Install dependensi
npm install

# Build tampilan frontend produksi
npm run build
```

### 6.1. Menjalankan di Background pada Windows (PM2 Startup)

Agar aplikasi tetap berjalan di background tanpa jendela CMD yang harus terus terbuka:

```powershell
# 1. Install PM2 dan pm2-windows-startup secara global
npm install -g pm2 pm2-windows-startup

# 2. Pasang hook startup di registry Windows
pm2-startup install

# 3. Set environment variable produksi & jalankan server dengan PM2
$env:NODE_ENV="production"
$env:PORT="3000"
pm2 start node_modules\tsx\dist\cli.mjs --name "billing-isp" -- server.ts

# 4. Simpan konfigurasi PM2 agar otomatis jalan saat Windows restart
pm2 save
```

Kini aplikasi dapat diakses dari komputer tersebut melalui `http://localhost:3000` atau dari HP/perangkat lain di jaringan LAN yang sama melalui `http://<IP-LAN-Komputer-Windows>:3000`.

---

## 7. Panduan Persiapan Port & User API di Router MikroTik

Agar fitur **Monitoring MikroTik Real-Time**, **Isolir/Buka Isolir**, dan **Reset Koneksi PPPoE** dapat terhubung ke router MikroTik Anda (baik RouterOS v6 maupun RouterOS v7), lakukan persiapan berikut di MikroTik Anda:

### A. Mengaktifkan Service API via Winbox
1. Buka **Winbox** dan login ke router MikroTik Anda.
2. Masuk ke menu **IP** -> **Services**.
3. Klik dua kali pada baris **`api`** (port default adalah **`8728`**):
   - Pastikan statusnya **Enabled** (tidak berwarna abu-abu/silang).
   - *(Opsional namun disarankan)* Pada kolom **Available From**, Anda dapat mengisikan IP Server Billing Anda agar port API hanya bisa diakses oleh server aplikasi ini.
   - Klik **OK**.

### B. Membuat Group & User Khusus API Billing via Winbox
1. Masuk ke menu **System** -> **Users** -> pindah ke tab **Groups**.
2. Klik tombol **`+` (Add)**:
   - **Name**: `billing-api-group`
   - **Policy**: Centang **`read`**, **`write`**, **`api`**, dan **`test`** (policy `write` diperlukan jika Anda ingin menggunakan tombol Isolir/Buka Isolir & Reset PPPoE dari aplikasi).
   - Klik **OK**.
3. Pindah ke tab **Users** -> klik tombol **`+` (Add)**:
   - **Name**: `billing_api`
   - **Group**: `billing-api-group`
   - **Password**: Masukkan password yang kuat.
   - Klik **OK**.

### C. Alternatif Konfigurasi Cepat via New Terminal (CLI MikroTik)
Salin dan tempelkan perintah berikut ke dalam **New Terminal** Winbox Anda:

```routeros
# 1. Aktifkan service API pada port 8728
/ip service enable api
/ip service set api port=8728

# 2. Buat group khusus untuk aplikasi billing dengan izin API & Write
/user group add name=billing-api-group policy=read,write,api,test

# 3. Buat user khusus untuk aplikasi billing (Ganti password sesuai keinginan Anda)
/user add name=billing_api password="PasswordKuat123!" group=billing-api-group comment="User API Simple Billing Mini ISP"
```

### D. Menghubungkan di Aplikasi Simple Billing Mini ISP
1. Buka aplikasi -> masuk ke menu **Pengaturan** -> bagian **5. Integrasi API Router MikroTik**.
2. Masukkan **Host / IP Publik / IP VPN Tunnel MikroTik**, **Port API (`8728`)**, **Username (`billing_api`)**, **Password**, serta **Nama Profile Isolir PPPoE** (misal: `ISOLIR`).
3. Klik **"Tes Koneksi API"** untuk memastikan router merespons dengan status **Terhubung**, lalu klik **"Simpan Pengaturan"**.

---

## 8. Panduan Reverse Proxy Nginx (HTTPS SSL) & Cloudflare Tunnel

Jika Anda ingin mengakses aplikasi ini dari luar jaringan rumah/kantor menggunakan nama domain sendiri dengan koneksi aman **HTTPS (`https://billing.domainanda.com`)**:

### Opsi 1: Menggunakan Nginx + Certbot Let's Encrypt (VPS / IP Publik)

```bash
# Install Nginx dan Certbot di Ubuntu/Debian
sudo apt install -y nginx certbot python3-certbot-nginx

# Buat file konfigurasi virtual host Nginx
sudo nano /etc/nginx/sites-available/billing-isp
```

Isi dengan konfigurasi berikut (ganti `billing.domainanda.com` dengan domain Anda):

```nginx
server {
    listen 80;
    server_name billing.domainanda.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi dan pasang sertifikat SSL gratis:

```bash
sudo ln -s /etc/nginx/sites-available/billing-isp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Pasang SSL HTTPS otomatis dengan Certbot
sudo certbot --nginx -d billing.domainanda.com
```

### Opsi 2: Menggunakan Cloudflare Zero Trust Tunnel (Tanpa IP Publik / Di Balik NAT ISP)

Jika server lokal (STB / Mini PC / Docker) Anda berada di rumah/kantor tanpa IP Publik statis:
1. Buka dashboard [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) -> menu **Networks** -> **Tunnels**.
2. Klik **Create a tunnel** -> pilih **Cloudflared** -> beri nama `billing-mini-isp`.
3. Salin dan jalankan perintah instalasi connector `cloudflared` sesuai sistem operasi Anda (Linux / Windows / Docker).
4. Pada tab **Public Hostname**, tambahkan subdomain:
   - **Subdomain**: `billing`
   - **Domain**: `domainanda.com`
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000`
5. Simpan, dan aplikasi Anda langsung dapat diakses dari mana saja melalui `https://billing.domainanda.com` lengkap dengan proteksi SSL Cloudflare.

---

## 9. Struktur Penyimpanan Data & Backup

Seluruh data penting aplikasi disimpan secara terpusat di dalam folder **`/data`**:
- **`/data/db.json`**: Menyimpan seluruh data Pelanggan, Paket WiFi, Tagihan Bulanan, Pengeluaran Operasional, dan Pengaturan Aplikasi.
- **`/data/uploads/`**: Menyimpan file gambar Logo Perusahaan, Tanda Tangan/Stempel Invoice, serta Foto Bukti Pembayaran pelanggan.

**Tips Keamanan Data:**
- Gunakan tombol **"Backup Data (.XLSX)"** di menu **Pengaturan** secara berkala (misalnya setiap akhir bulan) untuk menyimpan salinan data ke HP/komputer Anda.
- Jika berpindah server baru, Anda cukup menginstal aplikasi ini di server baru lalu mengunggah file `.xlsx` tersebut melalui fitur **"Restore Data (.XLSX)"** di menu Pengaturan, atau menyalin folder `/data` ke server baru.

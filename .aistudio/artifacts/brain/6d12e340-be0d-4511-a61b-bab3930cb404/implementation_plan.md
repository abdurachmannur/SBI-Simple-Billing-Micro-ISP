# Peningkatan Lengkap Simple Billing Mini ISP: Menu Monitoring MikroTik API + 5 Fitur Operasional Lanjutan

Rencana ini menggabungkan **Menu Monitoring Pelanggan MikroTik (Koneksi Langsung ke Router)** dengan **5 fitur peningkatan operasional** yang telah Anda konfirmasi sebelumnya.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah rincian keputusan teknis dan produk yang telah dikonfirmasi:

1. **Menu Baru "Monitoring" (Integrasi Langsung MikroTik API)**:
   - **Koneksi Langsung (Tanpa Data Palsu/Simulasi)**: Terhubung langsung dari server backend ke IP Publik / Domain DDNS / IP Tunnel VPN MikroTik Anda. Mendukung protokol **RouterOS API (Port 8728 / 8729 TLS - RouterOS v6 & v7)** maupun **RouterOS REST API (HTTP/HTTPS - RouterOS v7)**.
   - **Multi-Metode Pemantauan**: Mengambil data dari **PPPoE Active & PPPoE Secret**, **Simple Queue** (untuk penggunaan *traffic* Rx/Tx *upload/download* dan pemakaian kuota/bytes), serta **Netwatch / ARP / IP Binding** (untuk memantau status *Online / Offline* pelanggan berbasis IP Statis).
   - **Pencocokan Pelanggan Pintar & Pengurutan (*Sorting*)**: Mencocokkan data dari MikroTik dengan daftar Pelanggan aplikasi berdasarkan `IP / Username PPPoE` atau nama pelanggan. Pengguna dapat mengurutkan (*sort*) dan memfilter berdasarkan **Status (Offline Dulu / Online Dulu)** untuk mendeteksi gangguan dengan cepat, **Traffic Tertinggi (Rx/Tx)**, **Uptime Koneksi**, atau **Status Isolir**.
   - **Indikator Kesehatan Router**: Menampilkan **Beban CPU (%)**, **Penggunaan Memori RAM**, **Uptime Router**, dan **Versi RouterOS / Board Name** secara real-time di bagian atas halaman Monitoring.
   - **Tindakan Kontrol Langsung**: Menyediakan tombol **Isolir (Disable PPPoE Secret / Queue)**, **Buka Isolir (Enable)**, dan **Reset / Kick Koneksi Aktif** langsung dari daftar monitoring dengan konfirmasi keamanan.

2. **Kelima Fitur Peningkatan Operasional Lainnya (Tetap Disertakan Penuh)**:
   - **Restore Data dari File Backup `.XLSX` di Pengaturan** (mendukung mode *Gabungkan* atau *Timpa Semua*).
   - **Tanggal Jatuh Tempo (`1`–`28`) & Filter Tagihan Menunggak (*Overdue*)** di halaman Tagihan & Pelanggan.
   - **Matriks Riwayat Pembayaran 12 Bulan (Jan–Des)** pada detail setiap pelanggan.
   - **Pilihan Ukuran Cetak Struk Termal (`58mm` / `80mm`) & `A4`** pada pratinjau Invoice.
   - **Data Teknis Pelanggan (`Username PPPoE / IP`, `Info ODP / Perangkat`, dan `Link Google Maps` satu klik)**.

---

## 1. Overview & Core Concept

- **What It Does**: Menyatukan pembukuan tagihan WiFi dengan pemantauan teknis jaringan MikroTik dalam satu aplikasi. Saat pelanggan melapor internet mati atau lambat, admin dapat langsung membuka menu **Monitoring**, mengurutkan pelanggan berstatus **Offline**, memeriksa *traffic* *Upload/Download* (`Rx/Tx`) saat ini, me-*reset* sesi PPPoE yang macet, atau mengisolir pelanggan yang menunggak tagihan.
- **Target Audience / Persona**: Pemilik RT/RW Net, teknisi jaringan MikroTik, dan kasir penagihan.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Konfigurasi Koneksi MikroTik (di Pengaturan atau langsung dari halaman Monitoring)**:
   - Pengguna memasukkan **Host / IP Publik / VPN Tunnel MikroTik** (beserta port, misal `8728` untuk API standar atau `80`/`443` untuk REST API v7), **Username**, dan **Password** MikroTik.
   - Tersedia tombol **Tes Koneksi MikroTik** yang langsung menghubungi router dan menampilkan identitas router (*Identity*, *Board Name*, *RouterOS Version*) jika berhasil.
2. **Pemantauan Pelanggan & Deteksi Gangguan di Menu Monitoring**:
   - Bagian atas menampilkan kartu **Status Router MikroTik**: Nama Router, Uptime, Beban CPU (%), Penggunaan RAM (MB/%), serta total pelanggan **Online**, **Offline**, dan **Terisolir**.
   - Bilah filter & pengurutan menyediakan:
     - Filter cepat: **Semua**, **Offline (Gangguan/Mati)**, **Online (Aktif)**, dan **Terisolir (Disabled)**.
     - Pengurutan (*Sort*): **Status (Offline Dulu)**, **Status (Online Dulu)**, **Traffic Download (Tertinggi)**, **Traffic Upload (Tertinggi)**, **Uptime Terlama/Terbaru**, dan **Nama Pelanggan (A-Z)**.
     - Sakelar **Auto-Refresh (tiap 10 detik)** atau tombol **Segarkan Sekarang** untuk memantau pergerakan *traffic* secara langsung.
   - Setiap baris pelanggan menampilkan:
     - Nama Pelanggan & Info ODP + tombol cepat **Lokasi Maps** & **Chat WA**.
     - Status Koneksi (**ONLINE** / **OFFLINE** / **TERISOLIR**) beserta sumber deteksi (`PPPoE`, `Simple Queue`, atau `Netwatch/ARP`), alamat IP aktif, dan lama waktu terhubung (*Uptime*).
     - Kecepatan *Traffic* saat ini (**Download Rx / Upload Tx** dalam `Mbps`/`Kbps`) dan total pemakaian data sesi berjalan.
     - Tombol Aksi: **Reset Sesi (Kick)** untuk menyegarkan koneksi pelanggan, serta tombol **Isolir / Buka Isolir**.

---

## 3. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        SIMPLE BILLING MINI ISP (React)                     │
├────────────────────────────────────────────────────────────────────────────┤
│  Navigation Shell (7 Menu Utama)                                           │
│  ├── 1. Dashboard    ├── 4. Monitoring (BARU - MikroTik Live)              │
│  ├── 2. Pelanggan    ├── 5. Pengeluaran                                    │
│  ├── 3. Tagihan      ├── 6. Paket WiFi      └── 7. Pengaturan              │
├────────────────────────────────────────────────────────────────────────────┤
│  MikroTik Monitoring & Control Flow                                        │
│  ├── MonitoringView.tsx                                                    │
│  │   ├── Router System Health Bar (Identity, Version, Uptime, CPU, RAM)    │
│  │   ├── Status Filter (All/Offline/Online/Isolated) & Traffic Sorter      │
│  │   ├── Auto-Refresh Polling Toggle (Off / 5s / 10s / 30s)                │
│  │   └── Customer Connection Table & Mobile Cards                          │
│  │       └── Direct Actions: Kick Session | Toggle Isolir | WA | Maps      │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  EXPRESS BACKEND PROXY & MIKROTIK CLIENT                   │
│  ├── Native RouterOS API Socket Client (Port 8728/8729 TCP + MD5/Plain)    │
│  ├── RouterOS v7 REST API Client (HTTP/HTTPS Basic Auth Fallback)          │
│  └── Endpoints:                                                            │
│      ├── POST /api/mikrotik/test        (Verify Connection & Identity)     │
│      ├── GET  /api/mikrotik/monitor     (Fetch Resource, PPPoE, Queues,    │
│      │                                   Netwatch/ARP & Merge w/ Customers)│
│      └── POST /api/mikrotik/action      (Isolir/Enable Secret or Queue,    │
│                                          Kick Active PPPoE Session)        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Implementasi Klien MikroTik di Backend (`server.ts`)
- Agar tidak bergantung pada pustaka pihak ketiga yang rawan masalah kompatibilitas, `server.ts` akan menyertakan modul **MikroTik RouterOS Connector** bawaan (`net` / `tls` socket untuk RouterOS API port `8728`/`8729` baik metode login RouterOS v6.43+ maupun legacy challenge, serta `fetch` HTTP/HTTPS untuk RouterOS v7 REST API).
- Kredensial MikroTik (`mikrotik_host`, `mikrotik_port`, `mikrotik_user`, `mikrotik_password`, `mikrotik_mode`: `'api' | 'rest-http' | 'rest-https'`) disimpan dengan aman di dalam `AppSettings` milik pengguna di server, sehingga password router tidak pernah terekspos ke pihak lain.
- Saat `/api/mikrotik/monitor` dipanggil, server mengambil:
  1. `/system/resource/print` & `/system/identity/print` (CPU, Memory, Uptime, Nama Router).
  2. `/ppp/secret/print` & `/ppp/active/print` (daftar akun PPPoE, status disabled/isolir, IP aktif, uptime, caller-id/MAC).
  3. `/queue/simple/print` (kecepatan `rate` Rx/Tx *real-time* dan `bytes` pemakaian per target IP atau nama queue).
  4. `/tool/netwatch/print` & `/ip/arp/print` (status host `up`/`down` untuk pelanggan IP statis).
- Data tersebut dipadukan dengan daftar `Customer` (mencocokkan `pppoe_user` atau nama pelanggan) sehingga pengguna dapat melihat seluruh pelanggan terdaftar maupun koneksi aktif di MikroTik dalam satu tabel terpadu.

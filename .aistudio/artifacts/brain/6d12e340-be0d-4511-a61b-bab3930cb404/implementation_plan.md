# Simple Billing Mini ISP — Rilis Produksi & Keamanan Login (`v1.3.0`)

Mempersiapkan **Simple Billing Mini ISP (`v1.3.0`)** untuk penggunaan produksi yang dapat diakses dari jaringan publik (internet) melalui sistem **Autentikasi Login Admin**, **tampilan Logo Bisnis dinamis pada halaman Login**, **proteksi Brute-Force**, **enkripsi password Scrypt**, **sesi ketat dengan batas inaktivitas 2 jam**, serta **pengamanan penuh seluruh endpoint API & kredensial MikroTik**.

---

## User Review & Keputusan yang Dikonfirmasi

> [!IMPORTANT]
> Seluruh preferensi keamanan produksi dari jawaban Anda telah dikunci ke dalam rancangan arsitektur **`v1.3.0`** di bawah ini.

- **Manajemen Akun Login**: Menggunakan **satu akun Admin utama** dengan kredensial awal (*default*) **`admin` / `admin123`** yang dapat diubah username dan password-nya kapan saja melalui menu **Pengaturan**.
- **Wajib Ganti Password Saat Pertama Kali Login**: Ketika pengguna masuk menggunakan password default (`admin123`), aplikasi akan menampilkan layar/modal khusus **Wajib Ganti Password Awal** sebelum mengizinkan akses ke menu operasional.
- **Halaman Login dengan Logo Bisnis**: Menampilkan **Logo Bisnis** (yang diunggah di Pengaturan), **Nama Aplikasi**, dan **Nama Bisnis** secara publik melalui endpoint branding khusus yang aman tanpa membocorkan data pelanggan atau konfigurasi sensitif.
- **Pengamanan Publik (Public-Facing Security Hardening)**:
  1. **Proteksi Brute-Force**: Maksimal **5 kali percobaan gagal** dari alamat IP yang sama akan memblokir sementara (*lockout*) percobaan login dari IP tersebut selama **15 menit** disertai penghitung waktu mundur (*countdown*).
  2. **Enkripsi Password & Token Kriptografi**: Password disimpan menggunakan algoritma **`node:crypto.scryptSync`** beserta *random salt* 16-byte dan diverifikasi dengan **`timingSafeEqual`** (mencegah *Timing Attack*). Sesi login menggunakan token acak 256-bit yang ditandatangani secara kriptografi (HMAC-SHA256).
  3. **Sembunyikan Kredensial Rahasia MikroTik**: Endpoint `GET /api/settings` tidak lagi mengirimkan `mikrotik_password` asli dalam bentuk teks terbuka ke browser, melainkan mengirimkan penanda aman (`••••••••`) kecuali saat diubah secara eksplisit oleh Admin.
  4. **Sesi Ketat Auto-Logout 2 Jam Inaktivitas**: Baik di sisi server (validasi *sliding expiration* 2 jam per token sesi) maupun di sisi browser (pemantau aktivitas klik/ketik/gerak mouse), sesi akan otomatis keluar setelah **2 jam tanpa aktivitas**.

---

## 1. Gambaran Umum & Konsep Inti

- **Apa yang Dilakukan**: Menambahkan gerbang keamanan berlapis (*Production Authentication & API Guard*) di depan seluruh fitur manajemen pelanggan, tagihan, monitoring MikroTik, backup/restore, dan update GitHub.
- **Target Pengguna**: Pemilik atau Administrator RT/RW Net & Mini ISP yang men-deploy aplikasi di VPS, Cloud, atau Cloudflare Tunnel sehingga dapat diakses dari internet publik dengan aman.
- **Nilai Utama**: Mencegah pihak luar mengakses data pelanggan, memanipulasi tagihan, melihat password router MikroTik, atau mengeksekusi perintah ke router meskipun URL aplikasi diketahui publik.

---

## 2. Pengalaman Pengguna (UX) & Desain Visual

### Alur Pengguna Utama (Key User Flows)
1. **Membuka Aplikasi (Belum Login)**:
   - Aplikasi memanggil endpoint publik `GET /api/auth/public-branding` untuk memuat **Logo Bisnis**, **Nama Aplikasi**, dan **Nama Bisnis** yang telah diatur di Pengaturan.
   - Pengguna melihat halaman **Login Admin** dengan tampilan bersih, menampilkan Logo Bisnis (atau ikon WiFi default jika logo belum diunggah), kolom **Username**, kolom **Password** (dengan tombol lihat/sembunyikan karakter), serta informasi petunjuk login awal jika password default belum pernah diganti.
2. **Proteksi Brute-Force Saat Login**:
   - Jika pengguna salah memasukkan password, muncul pesan sisa kesempatan percobaan (misal: *"Username atau password salah. Sisa 3 percobaan sebelum dikunci sementara"*).
   - Jika gagal 5 kali berturut-turut, tombol Masuk dinonaktifkan sementara selama 15 menit disertai informasi sisa waktu tunggu.
3. **Wajib Ganti Password Default (First-Login Setup)**:
   - Saat login pertama kali menggunakan kredensial default (`admin` / `admin123`), pengguna langsung diarahkan ke tampilan **Keamanan Produksi: Ganti Password Default** untuk menetapkan username baru (opsional) dan password baru minimal 8 karakter sebelum masuk ke Dashboard.
4. **Selama Sesi Aktif & Auto-Logout 2 Jam**:
   - Di pojok sidebar/header terdapat profil **Admin**, indikator sesi aman, dan tombol **Keluar (Logout)**.
   - Setiap aktivitas API memperbarui waktu aktif sesi (*sliding window* 2 jam). Jika tidak ada aktivitas selama 2 jam penuh, sesi otomatis dihentikan dan pengguna dikembalikan ke layar Login dengan notifikasi *"Sesi Anda telah berakhir karena tidak ada aktivitas selama 2 jam"*.
5. **Ubah Username & Password di Menu Pengaturan**:
   - Di menu **Pengaturan**, terdapat kartu baru **Keamanan Akun Login Admin** untuk mengubah Username, memverifikasi Password Lama, dan menyimpan Password Baru (yang akan langsung memperbarui sesi aktif dan mencabut sesi di perangkat lain).

### Identitas Visual & Tema
- **Aesthetic Direction**: Utilitarian Enterprise SaaS Console — tegas, bersih, dan terpercaya.
- **Color Palette & Mood**: Kanvas netral bersih (`#F8FAFC` / Slate-50) dengan kartu putih berbatas halus (`1px solid #E2E8F0`), aksen biru utama (`#2563EB` / Blue-600) untuk tombol utama, hijau (`#16A34A`) untuk indikator keamanan aktif, dan merah (`#DC2626`) untuk peringatan percobaan gagal/lockout.
- **Typography & Hierarchy**: Menggunakan `Plus Jakarta Sans` / sans modern yang tajam untuk judul halaman login dan nama bisnis, serta `JetBrains Mono` (`tabular-nums`) untuk informasi versi aplikasi (`v1.3.0`) dan hitung mundur waktu blokir brute-force.

---

## 3. Keputusan Produk & Pertimbangan Teknis (Trade-Offs)

- **Keputusan 1: Pemisahan Endpoint Branding Publik (`GET /api/auth/public-branding`) vs Pengaturan Penuh (`GET /api/settings`)**
  - *Pendekatan Terpilih*: Menyediakan endpoint khusus tanpa autentikasi yang **hanya** mengembalikan `app_name`, `business_name`, `logo_url`, dan status `isDefaultPassword` untuk kebutuhan halaman Login, sementara `GET /api/settings` dikunci penuh dengan middleware autentikasi.
  - *Alasan*: Agar halaman Login tetap bisa menampilkan Logo Bisnis yang diunggah di Pengaturan tanpa membocorkan nomor rekening, template WA, atau IP/User MikroTik ke publik sebelum login.
- **Keputusan 2: Penyimpanan Hash Password dengan `node:crypto.scrypt` & Token Sesi Server-Side**
  - *Pendekatan Terpilih*: Menggunakan modul kriptografi bawaan Node.js (`scryptSync`, `randomBytes`, `timingSafeEqual`) ditambah daftar sesi aktif di server dengan *sliding expiry* 2 jam.
  - *Alasan*: Tidak menambah dependensi native C++ eksternal (seperti `bcrypt` yang sering gagal *build* di Linux Alpine/Windows), tahan terhadap serangan *brute-force* GPU/CPU, dan memungkinkan pencabutan sesi (*revoke*) seketika saat password diubah atau tombol Logout ditekan.
- **Keputusan 3: Masking Password MikroTik (`••••••••`)**
  - *Pendekatan Terpilih*: Backend tidak pernah mengirimkan string asli `mikrotik_password` ke frontend. Backend hanya mengirimkan flag `has_mikrotik_password: true` dan nilai masked. Jika Admin menyimpan pengaturan tanpa mengetik ulang password MikroTik baru, backend mempertahankan password lama yang tersimpan di `db.json`.
  - *Alasan*: Mencegah kebocoran password router MikroTik melalui *Inspect Element / Network Tab* di browser.

---

## 4. Arsitektur Teknis & Strategi Data

### Diagram Arsitektur Keamanan & Alur Data

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER (React 19 SPA)                        │
│                                                                              │
│  ┌──────────────────────────┐        ┌────────────────────────────────────┐  │
│  │   LoginView (Public)     │        │   ForceChangePasswordModal         │  │
│  │ • Logo Bisnis Dinamis    │───────▶│ • Muncul jika mustChangePassword   │  │
│  │ • Form User & Password   │        │ • Wajib password baru >= 8 kar.    │  │
│  │ • Info Lockout / Sisa    │        └─────────────────┬──────────────────┘  │
│  └────────────┬─────────────┘                          │                     │
│               │ Bearer Session Token                   ▼                     │
│               │ + 2-Hour Idle Watcher   ┌─────────────────────────────────┐  │
│               └────────────────────────▶│   Authenticated Workspace       │  │
│                                         │ • Dashboard, Pelanggan, Tagihan │  │
│                                         │ • Monitoring MikroTik, Paket    │  │
│                                         │ • Pengaturan (+ Ubah Akun Login)│  │
│                                         │ • Tombol Keluar (Logout)        │  │
│                                         └──────────────┬──────────────────┘  │
└────────────────────────────────────────────────────────┼─────────────────────┘
                                                         │
                                     Authorization: Bearer <signed_token>
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS PRODUCTION SERVER (Node.js 22)                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Public Endpoints (Tanpa Token)                                      │  │
│  │    • GET  /api/auth/public-branding -> { app_name, business_name, logo}│  │
│  │    • POST /api/auth/login           -> Brute-Force Limiter (5x / 15m)  │  │
│  │    • GET  /uploads/logo_*           -> Hanya file logo yang publik     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Auth Guard Middleware (Wajib Token Valid & Belum Idle > 2 Jam)      │  │
│  │    • Memeriksa tanda tangan HMAC & batas inaktivitas 120 menit         │  │
│  │    • Memperbarui lastActiveAt pada setiap request valid                │  │
│  │    • Melindungi SELURUH /api/customers, /api/payments, /api/mikrotik,  │  │
│  │      /api/settings, /api/backup, /api/system/*, dll.                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. Persistent Storage (data/db.json)                                   │  │
│  │    • admin_auth: { username, passwordHash, salt, mustChangePassword }  │  │
│  │    • app_settings: { ..., mikrotik_password (masked saat dikirim) }    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Model Data & State Autentikasi
- **Entitas `AdminAuthRecord` di `data/db.json`**:
  - `username`: Default `"admin"`.
  - `passwordHash`: Hash Scrypt 64-byte dalam format hex.
  - `passwordSalt`: Salt acak 16-byte dalam format hex.
  - `mustChangePassword`: `true` saat pertama kali diinisialisasi dengan password default `"admin123"`, otomatis menjadi `false` setelah Admin mengganti password.
  - `updatedAt`: Timestamp perubahan kredensial terakhir.
- **Manajemen Sesi & Rate Limiter di Server**:
  - `activeSessions` (`Map<tokenId, { username, createdAt, lastActiveAt, ip }>`): Setiap request yang terautentikasi memeriksa apakah `Date.now() - lastActiveAt <= 2 * 60 * 60 * 1000` (2 jam). Jika lewat 2 jam, sesi dihapus dan mengembalikan `401 Unauthorized`.
  - `loginAttempts` (`Map<ip, { count, firstAttemptAt, lockedUntil }>`): Mencatat kegagalan login per IP. Setelah 5 kali gagal, `lockedUntil` disetel ke `Date.now() + 15 * 60 * 1000` (15 menit).

### Pemetaan Komponen Interaktif & Penanganan State
- **`LoginView.tsx`**:
  - Memuat logo bisnis dari `/api/auth/public-branding` dengan fallback ikon WiFi jika belum ada logo atau gagal dimuat.
  - Menangani submit form login (`POST /api/auth/login`), menampilkan indikator loading, pesan error sisa percobaan, atau penghitung mundur jika IP sedang terblokir sementara.
- **Modal Wajib Ganti Password Awal (`FirstLoginPasswordModal`)**:
  - Muncul otomatis setelah login apabila `mustChangePassword === true`.
  - Memvalidasi password baru (minimal 8 karakter, konfirmasi cocok, dan tidak boleh sama dengan `admin123`), lalu memanggil `POST /api/auth/change-password`.
- **Kartu Keamanan Akun Login di `SettingsView.tsx`**:
  - Memungkinkan Admin mengubah username dan password kapan saja dengan memverifikasi password saat ini terlebih dahulu.
  - Mengamankan input password MikroTik agar menampilkan indikator `"Password Tersimpan Aman (Kosongkan jika tidak ingin mengubah)"`.
- **Pembaruan Versi Aplikasi (`v1.3.0`) & Dokumentasi `README.md`**:
  - Menaikkan versi di `version.json` dan `package.json` menjadi **`1.3.0`** lengkap dengan catatan *changelog* rilis keamanan produksi.
  - Memperbarui `README.md` dengan informasi kredensial login default (`admin` / `admin123`) serta fitur keamanan produksi yang baru.

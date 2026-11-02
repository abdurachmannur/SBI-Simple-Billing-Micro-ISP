import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Upload,
  Building2,
  Landmark,
  MessageSquare,
  Trash2,
  Info,
  FileSpreadsheet,
  Download,
  Router,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, Customer, Expense, Payment, WifiPackage } from '../types';
import { exportFullBackupToXlsx, parseFullBackupXlsx } from '../utils';
import { api } from '../api';
import { ConfirmDialog, Modal } from './Modal';

interface SettingsViewProps {
  ownerId: string;
  settings: AppSettings;
  customers: Customer[];
  payments: Payment[];
  expenses: Expense[];
  packages: WifiPackage[];
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
  onUploadLogo: (dataUrl: string) => Promise<string>;
  onRestoreBackup: (payload: {
    mode: 'merge' | 'replace';
    customers: Partial<Customer>[];
    payments: Partial<Payment>[];
    expenses: Partial<Expense>[];
    wifi_packages: Partial<WifiPackage>[];
  }) => Promise<{
    customersCount: number;
    paymentsCount: number;
    expensesCount: number;
    packagesCount: number;
  }>;
  onDeleteAccountData: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function SettingsView({
  ownerId,
  settings,
  customers,
  payments,
  expenses,
  packages,
  onSaveSettings,
  onUploadLogo,
  onRestoreBackup,
  onDeleteAccountData,
  onNotify,
}: SettingsViewProps) {
  const [appName, setAppName] = useState(settings.app_name);
  const [businessName, setBusinessName] = useState(settings.business_name);
  const [businessPhone, setBusinessPhone] = useState(settings.business_phone);
  const [businessAddress, setBusinessAddress] = useState(settings.business_address);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url);

  const [bankName, setBankName] = useState(settings.bank_name);
  const [bankAccount, setBankAccount] = useState(settings.bank_account);
  const [ewalletName, setEwalletName] = useState(settings.ewallet_name);
  const [ewalletAccount, setEwalletAccount] = useState(settings.ewallet_account);

  const [waTemplateUnpaid, setWaTemplateUnpaid] = useState(settings.wa_template_unpaid);
  const [waTemplatePaid, setWaTemplatePaid] = useState(settings.wa_template_paid);

  // MikroTik Router Configuration State
  const [mikrotikHost, setMikrotikHost] = useState(settings.mikrotik_host || '');
  const [mikrotikPort, setMikrotikPort] = useState<number>(settings.mikrotik_port || 8728);
  const [mikrotikUser, setMikrotikUser] = useState(settings.mikrotik_user || 'admin');
  const [mikrotikPassword, setMikrotikPassword] = useState(settings.mikrotik_password || '');
  const [mikrotikProtocol, setMikrotikProtocol] = useState<'api' | 'api-ssl' | 'rest-http' | 'rest-https'>(
    settings.mikrotik_protocol || 'api'
  );
  const [isTestingMikrotik, setIsTestingMikrotik] = useState(false);
  const [mikrotikTestResult, setMikrotikTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Restore Backup (.XLSX) State
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    fileName: string;
    customers: Partial<Customer>[];
    payments: Partial<Payment>[];
    expenses: Partial<Expense>[];
    wifi_packages: Partial<WifiPackage>[];
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAppName(settings.app_name);
    setBusinessName(settings.business_name);
    setBusinessPhone(settings.business_phone);
    setBusinessAddress(settings.business_address);
    setLogoUrl(settings.logo_url);
    setBankName(settings.bank_name);
    setBankAccount(settings.bank_account);
    setEwalletName(settings.ewallet_name);
    setEwalletAccount(settings.ewallet_account);
    setWaTemplateUnpaid(settings.wa_template_unpaid);
    setWaTemplatePaid(settings.wa_template_paid);
    setMikrotikHost(settings.mikrotik_host || '');
    setMikrotikPort(settings.mikrotik_port || 8728);
    setMikrotikUser(settings.mikrotik_user || 'admin');
    setMikrotikPassword(settings.mikrotik_password || '');
    setMikrotikProtocol(settings.mikrotik_protocol || 'api');
  }, [settings]);

  const handleProtocolChange = (proto: 'api' | 'api-ssl' | 'rest-http' | 'rest-https') => {
    setMikrotikProtocol(proto);
    if (proto === 'api' && (mikrotikPort === 8729 || mikrotikPort === 80 || mikrotikPort === 443)) {
      setMikrotikPort(8728);
    } else if (proto === 'api-ssl' && (mikrotikPort === 8728 || mikrotikPort === 80 || mikrotikPort === 443)) {
      setMikrotikPort(8729);
    } else if (proto === 'rest-http' && (mikrotikPort === 8728 || mikrotikPort === 8729 || mikrotikPort === 443)) {
      setMikrotikPort(80);
    } else if (proto === 'rest-https' && (mikrotikPort === 8728 || mikrotikPort === 8729 || mikrotikPort === 80)) {
      setMikrotikPort(443);
    }
  };

  const handleTestMikrotikConnection = async () => {
    if (!mikrotikHost.trim() || !mikrotikUser.trim()) {
      onNotify('Isi Host/IP Publik MikroTik dan Username terlebih dahulu.', 'error');
      return;
    }
    setIsTestingMikrotik(true);
    setMikrotikTestResult(null);
    try {
      const res = await api.testMikrotik(ownerId, {
        host: mikrotikHost.trim(),
        port: Number(mikrotikPort) || 8728,
        user: mikrotikUser.trim(),
        password: mikrotikPassword,
        protocol: mikrotikProtocol,
      });
      setMikrotikTestResult({
        ok: true,
        message: `Terhubung ke "${res.router.identity}" (${res.router.board_name} · RouterOS v${res.router.version}) — CPU ${res.router.cpu_load}%, RAM ${res.router.memory_used_percent}%, Uptime ${res.router.uptime}`,
      });
      onNotify(`Koneksi MikroTik berhasil: ${res.router.identity}`);
    } catch (err: any) {
      setMikrotikTestResult({
        ok: false,
        message: err?.message || 'Koneksi ke Router MikroTik gagal.',
      });
      onNotify(err?.message || 'Koneksi ke Router MikroTik gagal.', 'error');
    } finally {
      setIsTestingMikrotik(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      onNotify('Pilih file gambar yang valid (PNG, JPG, WEBP).', 'error');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });

      const uploadedUrl = await onUploadLogo(dataUrl);
      setLogoUrl(uploadedUrl);
      onNotify('Logo berhasil diunggah ke penyimpanan berkas. Klik Simpan Pengaturan untuk menerapkan.');
    } catch (err: any) {
      onNotify(err?.message || 'Gagal mengunggah logo.', 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const parsed = await parseFullBackupXlsx(file);
      const totalRows =
        parsed.customers.length +
        parsed.payments.length +
        parsed.expenses.length +
        parsed.wifi_packages.length;

      if (totalRows === 0) {
        onNotify('File Excel backup tidak berisi data yang dapat dipulihkan.', 'error');
        return;
      }

      setRestorePreview({
        fileName: file.name,
        ...parsed,
      });
      setRestoreMode('merge');
    } catch (err: any) {
      onNotify(err?.message || 'Gagal membaca file Backup Excel (.xlsx).', 'error');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    setIsRestoring(true);
    try {
      const res = await onRestoreBackup({
        mode: restoreMode,
        customers: restorePreview.customers,
        payments: restorePreview.payments,
        expenses: restorePreview.expenses,
        wifi_packages: restorePreview.wifi_packages,
      });
      setRestorePreview(null);
      onNotify(
        `Restore selesai! Kini tersimpan ${res.customersCount} pelanggan, ${res.paymentsCount} tagihan, ${res.expensesCount} pengeluaran, dan ${res.packagesCount} paket.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Gagal memulihkan data dari file backup.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      onNotify('Nama aplikasi wajib diisi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveSettings({
        app_name: appName.trim(),
        business_name: businessName.trim(),
        business_phone: businessPhone.trim(),
        business_address: businessAddress.trim(),
        logo_url: logoUrl.trim(),
        bank_name: bankName.trim(),
        bank_account: bankAccount.trim(),
        ewallet_name: ewalletName.trim(),
        ewallet_account: ewalletAccount.trim(),
        wa_template_unpaid: waTemplateUnpaid,
        wa_template_paid: waTemplatePaid,
        mikrotik_host: mikrotikHost.trim(),
        mikrotik_port: Number(mikrotikPort) || 8728,
        mikrotik_user: mikrotikUser.trim(),
        mikrotik_password: mikrotikPassword,
        mikrotik_protocol: mikrotikProtocol,
      });
      onNotify('Pengaturan bisnis, MikroTik API, dan template WhatsApp berhasil disimpan.');
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await onDeleteAccountData();
      setIsConfirmDeleteOpen(false);
      onNotify('Seluruh data bisnis pada profil ini berhasil dihapus dan direset.');
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghapus data bisnis.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const placeholders = [
    '{nama}',
    '{periode}',
    '{jumlah}',
    '{paket}',
    '{bisnis}',
    '{bank}',
    '{rekening}',
    '{ewallet}',
    '{no_ewallet}',
    '{metode}',
    '{tanggal_bayar}',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Identitas Aplikasi & Bisnis */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Profil Aplikasi & Bisnis ISP
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informasi ini ditampilkan pada navigasi aplikasi dan kop cetak Invoice A4 / Struk Termal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Aplikasi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Simple Billing Mini ISP"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Bisnis / Usaha WiFi
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Contoh: Nusantara Net WiFi"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor WhatsApp Bisnis
            </label>
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Bisnis
            </label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Jl. Merdeka Raya No. 45"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Logo Upload & Reference URL */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Logo Bisnis (Untuk Cetak Invoice)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo Bisnis"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-7 h-7 text-slate-400" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingLogo ? 'Mengunggah...' : 'Unggah File Logo'}</span>
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="min-h-[40px] px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>

              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Atau tempel URL gambar logo (mis. /uploads/... atau https://...)"
                className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Konfigurasi API Router MikroTik (Direct Public IP / VPN Tunnel) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Router className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Koneksi API Router MikroTik
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Digunakan oleh menu Monitoring untuk memantau PPPoE Active, Simple Queue, Netwatch, CPU/RAM, dan Isolir.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isTestingMikrotik}
            onClick={handleTestMikrotikConnection}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingMikrotik ? 'animate-spin' : ''}`} />
            <span>{isTestingMikrotik ? 'Menguji Koneksi...' : 'Tes Koneksi MikroTik'}</span>
          </button>
        </div>

        {mikrotikTestResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              mikrotikTestResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            {mikrotikTestResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{mikrotikTestResult.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              IP Publik / Host DDNS / VPN Tunnel MikroTik
            </label>
            <input
              type="text"
              value={mikrotikHost}
              onChange={(e) => setMikrotikHost(e.target.value)}
              placeholder="Contoh: 103.120.x.x atau id1.vpn.net:8728"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Protokol API RouterOS
            </label>
            <select
              value={mikrotikProtocol}
              onChange={(e) => handleProtocolChange(e.target.value as any)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            >
              <option value="api">RouterOS API Standar (TCP Port 8728)</option>
              <option value="api-ssl">RouterOS API-SSL (TLS Port 8729)</option>
              <option value="rest-http">RouterOS v7 REST API (HTTP)</option>
              <option value="rest-https">RouterOS v7 REST API (HTTPS)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Port API
            </label>
            <input
              type="number"
              min={1}
              max={65535}
              value={mikrotikPort}
              onChange={(e) => setMikrotikPort(Number(e.target.value))}
              placeholder="8728"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Username API MikroTik
            </label>
            <input
              type="text"
              value={mikrotikUser}
              onChange={(e) => setMikrotikUser(e.target.value)}
              placeholder="admin"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password API MikroTik
            </label>
            <input
              type="password"
              value={mikrotikPassword}
              onChange={(e) => setMikrotikPassword(e.target.value)}
              placeholder="Masukkan password user API MikroTik"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* 3. Rekening Bank & E-Wallet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rekening Bank & Akun E-Wallet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digunakan untuk informasi pembayaran pada pesan WhatsApp dan lembar Invoice.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Bank
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Contoh: BRI / Mandiri / BCA"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor Rekening & Atas Nama
            </label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Contoh: 1234-01-005678-53-1 a/n Nusantara Net"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama E-Wallet
            </label>
            <input
              type="text"
              value={ewalletName}
              onChange={(e) => setEwalletName(e.target.value)}
              placeholder="Contoh: DANA / OVO / GoPay"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor Akun E-Wallet
            </label>
            <input
              type="text"
              value={ewalletAccount}
              onChange={(e) => setEwalletAccount(e.target.value)}
              placeholder="Contoh: 081234567890 a/n Nusantara Net"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* 4. Template Pesan WhatsApp */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Template Pesan Pengingat & Konfirmasi WhatsApp
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gunakan variabel placeholder di bawah agar terisi otomatis sesuai data tagihan pelanggan.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Placeholder Variabel yang Tersedia:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
            {placeholders.map((ph) => (
              <span
                key={ph}
                className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md"
              >
                {ph}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Template Tagihan Belum Lunas (Pengingat)
            </label>
            <textarea
              rows={9}
              value={waTemplateUnpaid}
              onChange={(e) => setWaTemplateUnpaid(e.target.value)}
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Template Pembayaran Lunas (Bukti Konfirmasi)
            </label>
            <textarea
              rows={9}
              value={waTemplatePaid}
              onChange={(e) => setWaTemplatePaid(e.target.value)}
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan'}</span>
          </button>
        </div>
      </div>

      {/* 5. Backup & Restore Seluruh Data (.XLSX Tunggal) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Backup & Restore Seluruh Data (.XLSX)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Unduh seluruh data (Pelanggan, Tagihan, Pengeluaran, Paket WiFi) ke satu file Excel (.xlsx), atau pulihkan (Restore) data kembali dari file backup Anda kapan saja.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={restoreInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Restore dari Backup (.XLSX)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportFullBackupToXlsx(customers, payments, expenses, packages, settings);
                onNotify(
                  'File backup lengkap (.xlsx) berhasil diunduh (4 sheet: Pelanggan, Tagihan, Pengeluaran, Paket WiFi).'
                );
              }}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Backup Lengkap (.XLSX)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Data Pelanggan</span>
            <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
              {customers.length} baris
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Data Tagihan</span>
            <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
              {payments.length} baris
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Data Pengeluaran</span>
            <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
              {expenses.length} baris
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Paket WiFi</span>
            <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
              {packages.length} baris
            </p>
          </div>
        </div>
      </div>

      {/* 6. Zona Berbahaya: Penghapusan Data Akun Bisnis */}
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
            Hapus Akun & Seluruh Data Bisnis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Tindakan ini akan menghapus seluruh data pelanggan, riwayat tagihan, catatan pengeluaran, paket WiFi, dan pengaturan bisnis yang terhubung dengan profil Anda secara permanen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmDeleteOpen(true)}
          className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          <span>Hapus Data Akun</span>
        </button>
      </div>

      {/* Restore Backup Confirmation & Mode Modal */}
      <Modal
        isOpen={Boolean(restorePreview)}
        onClose={() => setRestorePreview(null)}
        title="Restore Data dari File Backup (.XLSX)"
        subtitle={restorePreview ? `File: ${restorePreview.fileName}` : ''}
      >
        {restorePreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Pelanggan Terbaca</span>
                <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {restorePreview.customers.length} baris
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Tagihan Terbaca</span>
                <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {restorePreview.payments.length} baris
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Pengeluaran Terbaca</span>
                <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {restorePreview.expenses.length} baris
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Paket WiFi Terbaca</span>
                <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {restorePreview.wifi_packages.length} baris
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Pilih Mode Pemulihan Data:
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="restore_mode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-1 text-blue-600"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    Gabungkan Data Baru (Aman / Tanpa Menghapus Data Lama)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Menambahkan pelanggan, tagihan, pengeluaran, dan paket yang belum ada tanpa menghapus data saat ini.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 cursor-pointer">
                <input
                  type="radio"
                  name="restore_mode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-1 text-amber-600"
                />
                <div className="text-xs">
                  <p className="font-bold text-amber-800 dark:text-amber-300">
                    Ganti & Timpa Seluruh Data Saat Ini
                  </p>
                  <p className="text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Menghapus data lama dan menggantinya secara penuh dengan isi file Backup Excel ini.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRestorePreview(null)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
              >
                {isRestoring ? 'Memulihkan Data...' : 'Proses Restore Data'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        isLoading={isDeletingAccount}
        title="Konfirmasi Penghapusan Akun & Data Bisnis"
        confirmLabel="Ya, Hapus Semua Data"
        message="Apakah Anda yakin ingin menghapus seluruh data pelanggan, tagihan, pembayaran, pengeluaran, dan pengaturan pada akun bisnis ini? Tindakan ini bersifat permanen dan tidak dapat dikembalikan."
      />
    </form>
  );
}

import React, { useEffect, useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Wifi,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AuthSessionInfo, PublicBrandingInfo } from '../types';
import { api, ApiError } from '../api';

interface LoginViewProps {
  ownerId: string;
  branding: PublicBrandingInfo | null;
  isDark: boolean;
  onToggleTheme: () => void;
  sessionExpiredMessage?: string;
  onLoginSuccess: (session: AuthSessionInfo) => void;
}

export function LoginView({
  ownerId,
  branding,
  isDark,
  onToggleTheme,
  sessionExpiredMessage,
  onLoginSuccess,
}: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  // Reset logo fallback when branding logo changes
  useEffect(() => {
    setLogoLoadFailed(false);
  }, [branding?.logo_url]);

  // Countdown timer when brute-force locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setErrorMsg('');
          setRemainingAttempts(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    if (!username.trim() || !password) {
      setErrorMsg('Masukkan username dan password Anda.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const session = await api.login(ownerId, {
        username: username.trim(),
        password,
      });
      onLoginSuccess(session);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
        if (typeof err.remainingAttempts === 'number') {
          setRemainingAttempts(err.remainingAttempts);
        }
        if (err.status === 429 && typeof err.retryAfterSeconds === 'number') {
          setLockoutSeconds(err.retryAfterSeconds);
          setRemainingAttempts(0);
        }
      } else {
        setErrorMsg(err?.message || 'Gagal melakukan autentikasi ke server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDefaultCredentials = () => {
    setUsername(branding?.defaultUsernameHint || 'admin');
    setPassword('admin123');
    setErrorMsg('');
  };

  const appTitle = branding?.app_name || 'Simple Billing Mini ISP';
  const businessName = branding?.business_name || 'Nusantara Net WiFi';
  const businessAddress = branding?.business_address || '';
  const hasLogo = Boolean(branding?.logo_url && !logoLoadFailed);

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6">
      {/* Top Bar: Security Notice & Theme Toggle */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4 pt-1">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Gerbang Produksi Terenkripsi</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">v{branding?.version || '1.3.0'}</span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Tema Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span>Tema Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* Main Centered Login Card */}
      <div className="my-auto py-8 w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Business Logo & Brand Identity */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden p-2 shrink-0">
              {hasLogo ? (
                <img
                  src={branding!.logo_url}
                  alt={businessName}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoLoadFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Wifi className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {businessName}
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {appTitle}
                {businessAddress ? ` · ${businessAddress}` : ''}
              </p>
            </div>
          </div>

          {/* Session Expired Notification Banner */}
          {sessionExpiredMessage && !errorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{sessionExpiredMessage}</div>
            </div>
          )}

          {/* Default User Credentials Hint (Only shown before first password change) */}
          {branding?.isDefaultPassword && (
            <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                  <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Akun Default Produksi Aktif</span>
                </div>
                <button
                  type="button"
                  onClick={fillDefaultCredentials}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Isi Otomatis
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Gunakan Username <code className="font-mono font-bold">admin</code> dan Password{' '}
                <code className="font-mono font-bold">admin123</code> untuk masuk pertama kali. Demi
                keamanan publik, Anda akan diminta mengganti password setelah login.
              </p>
            </div>
          )}

          {/* Brute-force Lockout or Login Error Box */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{errorMsg}</span>
              </div>
              {lockoutSeconds > 0 && (
                <div className="pl-6 font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
                  Silakan coba lagi dalam: {formatCountdown(lockoutSeconds)}
                </div>
              )}
              {lockoutSeconds === 0 &&
                remainingAttempts !== null &&
                remainingAttempts > 0 && (
                  <div className="pl-6 text-[11px] text-rose-600/90 dark:text-rose-300/90">
                    Peringatan Brute-Force: Sisa <strong>{remainingAttempts}x</strong> percobaan
                    sebelum IP dikunci sementara selama 15 menit.
                  </div>
                )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username Admin
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username admin"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full min-h-[44px] pl-10 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || lockoutSeconds > 0}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>
                {lockoutSeconds > 0
                  ? `Terkunci Sementara (${formatCountdown(lockoutSeconds)})`
                  : isSubmitting
                  ? 'Memverifikasi Kredensial...'
                  : 'Masuk ke Panel Billing'}
              </span>
            </button>
          </form>

          {/* Footer Security Info */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Proteksi Scrypt & Brute-Force</span>
            <span>Auto-Logout 2 Jam Idle</span>
          </div>
        </div>
      </div>

      {/* Bottom Copyright */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 pb-2">
        {businessName} · Sistem Manajemen Pelanggan & Monitoring MikroTik
      </footer>
    </div>
  );
}

interface FirstLoginPasswordModalProps {
  ownerId: string;
  currentUsername: string;
  onSuccess: (updatedUsername: string, newToken: string) => void;
  onLogout: () => void;
}

export function FirstLoginPasswordModal({
  ownerId,
  currentUsername,
  onSuccess,
  onLogout,
}: FirstLoginPasswordModalProps) {
  const [newUsername, setNewUsername] = useState(currentUsername || 'admin');
  const [currentPassword, setCurrentPassword] = useState('admin123');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setErrorMsg('Username minimal terdiri dari 3 karakter.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Demi keamanan produksi publik, password baru minimal 8 karakter.');
      return;
    }
    if (newPassword === 'admin123') {
      setErrorMsg('Password baru tidak boleh sama dengan password default (admin123).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.changeAdminCredentials(ownerId, {
        currentPassword,
        newUsername: newUsername.trim(),
        newPassword,
      });
      onSuccess(res.username, res.token);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memperbarui password admin.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Wajib Ganti Password Default
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Karena aplikasi ini siap diakses publik (Produksi), Anda wajib mengganti password
              default (<code className="font-mono">admin123</code>) sebelum melanjutkan.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Username Admin Baru (atau tetap <code className="font-mono">admin</code>)
            </label>
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password Saat Ini (Default)
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password Baru (Minimal 8 Karakter) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter kombinasi huruf & angka"
                className="w-full min-h-[44px] pl-3.5 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Konfirmasi Password Baru <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password baru"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Keluar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan & Aktifkan Keamanan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

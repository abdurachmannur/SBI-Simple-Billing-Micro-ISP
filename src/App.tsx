import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  TrendingDown,
  Wifi,
  Settings,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Activity,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  AppSettings,
  AuthSessionInfo,
  Customer,
  Expense,
  NavTab,
  Payment,
  PaymentStatus,
  PublicBrandingInfo,
  WifiPackage,
} from './types';
import {
  api,
  getStoredAuthToken,
  setStoredAuthToken,
  setUnauthorizedHandler,
} from './api';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { BillingView } from './components/BillingView';
import { ExpensesView } from './components/ExpensesView';
import { PackagesView } from './components/PackagesView';
import { MonitoringView } from './components/MonitoringView';
import { SettingsView } from './components/SettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { InvoiceModal } from './components/InvoiceModal';
import { FirstLoginPasswordModal, LoginView } from './components/LoginView';

const OWNER_STORAGE_KEY = 'sb_mini_isp_owner_id';
const THEME_STORAGE_KEY = 'sb_mini_isp_theme';
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // Strict 2-hour inactivity auto-logout

function getOrCreateOwnerId(): string {
  const existing = localStorage.getItem(OWNER_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }
  const generated = `isp_owner_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  localStorage.setItem(OWNER_STORAGE_KEY, generated);
  return generated;
}

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  const [ownerId, setOwnerId] = useState<string>(() => getOrCreateOwnerId());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark';
  });

  // Production Authentication & Session State
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [publicBranding, setPublicBranding] = useState<PublicBrandingInfo | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string>('');
  const lastActivityRef = useRef<number>(Date.now());

  // Global Quick Search & Global Invoice Preview State
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [globalInvoicePayment, setGlobalInvoicePayment] = useState<Payment | null>(null);

  // Global Period Filter
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Application Data State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>({
    ownerId,
    app_name: 'Simple Billing Mini ISP',
    business_name: 'Nusantara Net WiFi',
    business_phone: '',
    business_address: '',
    logo_url: '',
    bank_name: '',
    bank_account: '',
    ewallet_name: '',
    ewallet_account: '',
    wa_template_unpaid: '',
    wa_template_paid: '',
    mikrotik_host: '',
    mikrotik_port: 8728,
    mikrotik_user: 'admin',
    mikrotik_password: '',
    mikrotik_protocol: 'api',
  });
  const [packages, setPackages] = useState<WifiPackage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [isDark]);

  // Sync Document Title with AppSettings or PublicBranding
  useEffect(() => {
    const appTitle = settings.app_name || publicBranding?.app_name || 'Simple Billing Mini ISP';
    const bizName = settings.business_name || publicBranding?.business_name || '';
    document.title = bizName ? `${appTitle} — ${bizName}` : appTitle;
  }, [settings.app_name, settings.business_name, publicBranding]);

  // Load Public Branding (Logo Bisnis, Business Name, Version) for Login Screen
  const loadPublicBranding = useCallback(async (targetOwnerId: string) => {
    try {
      const brand = await api.getPublicBranding(targetOwnerId);
      setPublicBranding(brand);
    } catch {
      // ignore initial branding fetch error
    }
  }, []);

  // Perform Logout (manual or due to 2-hour inactivity / session expiration)
  const handleLogout = useCallback(
    async (expiredReason?: string) => {
      try {
        if (getStoredAuthToken()) {
          await api.logout(ownerId).catch(() => null);
        }
      } finally {
        setStoredAuthToken('');
        setIsAuthenticated(false);
        setMustChangePassword(false);
        setIsQuickSearchOpen(false);
        setGlobalInvoicePayment(null);
        if (expiredReason) {
          setSessionExpiredMessage(expiredReason);
        }
        loadPublicBranding(ownerId);
      }
    },
    [ownerId, loadPublicBranding]
  );

  // Register Global 401 Unauthorized Interceptor
  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      handleLogout(
        reason || 'Sesi login Anda telah berakhir (2 jam tanpa aktivitas). Silakan masuk kembali.'
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [handleLogout]);

  // Strict 2-Hour Client-Side Inactivity Watcher
  useEffect(() => {
    if (!isAuthenticated) return;
    lastActivityRef.current = Date.now();

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        handleLogout(
          'Sesi Anda otomatis keluar karena tidak ada aktivitas selama 2 jam demi keamanan produksi.'
        );
      }
    }, 30000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, handleLogout]);

  // Keyboard shortcut Ctrl+K / Cmd+K to open Quick Search (only when logged in)
  useEffect(() => {
    if (!isAuthenticated || mustChangePassword) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, mustChangePassword]);

  const fetchAllData = useCallback(
    async (targetOwnerId = ownerId) => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await api.bootstrap(targetOwnerId);
        setSettings(data.settings);
        setPackages(data.wifi_packages);
        setCustomers(data.customers);
        setPayments(data.payments);
        setExpenses(data.expenses);
        setPublicBranding((prev) => ({
          app_name: data.settings.app_name,
          business_name: data.settings.business_name,
          business_address: data.settings.business_address,
          logo_url: data.settings.logo_url,
          version: prev?.version || '1.3.0',
          isDefaultPassword: false,
        }));
      } catch (err: any) {
        setLoadError(err?.message || 'Gagal memuat data aplikasi.');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId]
  );

  // Initial Auth Session Verification on App Mount
  useEffect(() => {
    let active = true;
    (async () => {
      setIsCheckingAuth(true);
      await loadPublicBranding(ownerId);
      const existingToken = getStoredAuthToken();
      if (!existingToken) {
        if (active) setIsCheckingAuth(false);
        return;
      }
      try {
        const session = await api.getSession(ownerId);
        if (!active) return;
        if (session.authenticated) {
          if (session.ownerId && session.ownerId !== ownerId) {
            localStorage.setItem(OWNER_STORAGE_KEY, session.ownerId);
            setOwnerId(session.ownerId);
          }
          setAdminUsername(session.username);
          setMustChangePassword(Boolean(session.mustChangePassword));
          setIsAuthenticated(true);
          await fetchAllData(session.ownerId || ownerId);
        } else {
          setStoredAuthToken('');
          setIsAuthenticated(false);
        }
      } catch {
        if (active) {
          setStoredAuthToken('');
          setIsAuthenticated(false);
        }
      } finally {
        if (active) setIsCheckingAuth(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ownerId, loadPublicBranding, fetchAllData]);

  const handleLoginSuccess = async (session: AuthSessionInfo) => {
    if (session.token) {
      setStoredAuthToken(session.token);
    }
    const resolvedOwnerId = session.ownerId || ownerId;
    if (resolvedOwnerId !== ownerId) {
      localStorage.setItem(OWNER_STORAGE_KEY, resolvedOwnerId);
      setOwnerId(resolvedOwnerId);
    }
    setAdminUsername(session.username);
    setMustChangePassword(Boolean(session.mustChangePassword));
    setSessionExpiredMessage('');
    setIsAuthenticated(true);
    await fetchAllData(resolvedOwnerId);
    notify(`Selamat datang kembali, ${session.username}!`);
  };

  // Handlers for Customers
  const handleAddCustomer = async (c: Omit<Customer, 'id' | 'ownerId'>) => {
    const created = await api.createCustomer(ownerId, c);
    setCustomers((prev) => [...prev, created]);
  };

  const handleUpdateCustomer = async (id: string, c: Partial<Customer>) => {
    const updated = await api.updateCustomer(ownerId, id, c);
    setCustomers((prev) => prev.map((item) => (item.id === id ? updated : item)));
    if (updated.name) {
      setPayments((prev) =>
        prev.map((p) => (p.customer_id === id ? { ...p, customer_name: updated.name } : p))
      );
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    await api.deleteCustomer(ownerId, id);
    setCustomers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleImportCustomers = async (items: Partial<Customer>[]) => {
    const res = await api.importCustomers(ownerId, items);
    if (res.customers && res.customers.length > 0) {
      setCustomers((prev) => [...prev, ...res.customers]);
    }
    return {
      importedCount: res.importedCount,
      failedCount: res.failedCount,
      errors: res.errors,
    };
  };

  // Handlers for Payments / Billing
  const handleAddPayment = async (p: Omit<Payment, 'id' | 'ownerId'>) => {
    const created = await api.createPayment(ownerId, p);
    setPayments((prev) => [...prev, created]);
  };

  const handleUpdatePayment = async (id: string, p: Partial<Payment>) => {
    const updated = await api.updatePayment(ownerId, id, p);
    setPayments((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const handleDeletePayment = async (id: string) => {
    await api.deletePayment(ownerId, id);
    setPayments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBulkGeneratePayments = async (payload: {
    month: string;
    year: number;
    customer_ids: string[];
  }) => {
    const res = await api.bulkGeneratePayments(ownerId, payload);
    if (res.payments && res.payments.length > 0) {
      setPayments((prev) => [...prev, ...res.payments]);
    }
    return {
      createdCount: res.createdCount,
      skippedCount: res.skippedCount,
    };
  };

  const handleBulkUpdatePaymentStatus = async (payload: {
    payment_ids: string[];
    status: PaymentStatus;
    method?: string;
    payment_date?: string;
  }) => {
    const res = await api.bulkUpdatePaymentStatus(ownerId, payload);
    const updatedMap = new Map(res.payments.map((p) => [p.id, p]));
    setPayments((prev) => prev.map((p) => updatedMap.get(p.id) || p));
    return { updatedCount: res.updatedCount };
  };

  // Handlers for Expenses
  const handleAddExpense = async (e: Omit<Expense, 'id' | 'ownerId'>) => {
    const created = await api.createExpense(ownerId, e);
    setExpenses((prev) => [...prev, created]);
  };

  const handleUpdateExpense = async (id: string, e: Partial<Expense>) => {
    const updated = await api.updateExpense(ownerId, id, e);
    setExpenses((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(ownerId, id);
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  // Handlers for Packages
  const handleAddPackage = async (pkg: Omit<WifiPackage, 'id' | 'ownerId'>) => {
    const created = await api.createPackage(ownerId, pkg);
    setPackages((prev) => [...prev, created]);
  };

  const handleUpdatePackage = async (id: string, pkg: Partial<WifiPackage>) => {
    const updated = await api.updatePackage(ownerId, id, pkg);
    setPackages((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const handleDeletePackage = async (id: string) => {
    await api.deletePackage(ownerId, id);
    setPackages((prev) => prev.filter((item) => item.id !== id));
  };

  // Handlers for Settings & Restore
  const handleSaveSettings = async (updated: Partial<AppSettings>) => {
    const saved = await api.updateSettings(ownerId, updated);
    setSettings(saved);
    setPublicBranding((prev) => ({
      app_name: saved.app_name,
      business_name: saved.business_name,
      business_address: saved.business_address,
      logo_url: saved.logo_url,
      version: prev?.version || '1.3.0',
      isDefaultPassword: false,
    }));
  };

  const handleUploadLogo = async (dataUrl: string) => {
    const res = await api.uploadLogo(ownerId, dataUrl);
    return res.logo_url;
  };

  const handleRestoreBackup = async (payload: {
    mode: 'merge' | 'replace';
    customers: Partial<Customer>[];
    payments: Partial<Payment>[];
    expenses: Partial<Expense>[];
    wifi_packages: Partial<WifiPackage>[];
  }) => {
    const res = await api.restoreBackup(ownerId, payload);
    await fetchAllData();
    return {
      customersCount: res.customersCount,
      paymentsCount: res.paymentsCount,
      expensesCount: res.expensesCount,
      packagesCount: res.packagesCount,
    };
  };

  const handleDeleteAccountData = async () => {
    await api.deleteAccountData(ownerId);
    await fetchAllData();
    setActiveTab('dashboard');
  };

  const navItems: { id: NavTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Pelanggan', shortLabel: 'Pelanggan', icon: Users },
    { id: 'billing', label: 'Tagihan & Bayar', shortLabel: 'Tagihan', icon: Receipt },
    { id: 'monitoring', label: 'Monitoring MikroTik', shortLabel: 'Monitor', icon: Activity },
    { id: 'expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: TrendingDown },
    { id: 'packages', label: 'Paket WiFi', shortLabel: 'Paket', icon: Wifi },
    { id: 'settings', label: 'Pengaturan', shortLabel: 'Setelan', icon: Settings },
  ];

  const activeNavMeta = navItems.find((n) => n.id === activeTab) || navItems[0];

  // Initial Auth Loading Screen
  if (isCheckingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center animate-pulse">
            <Wifi className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Memverifikasi sesi keamanan produksi...
          </p>
        </div>
      </div>
    );
  }

  // Public Login Screen (with Dynamic Business Logo)
  if (!isAuthenticated) {
    return (
      <LoginView
        ownerId={ownerId}
        branding={publicBranding}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        sessionExpiredMessage={sessionExpiredMessage}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mandatory First-Login Password Change Modal */}
      {mustChangePassword && (
        <FirstLoginPasswordModal
          ownerId={ownerId}
          currentUsername={adminUsername}
          onSuccess={(newUsername, newToken) => {
            setAdminUsername(newUsername);
            setStoredAuthToken(newToken);
            setMustChangePassword(false);
            setPublicBranding((prev) =>
              prev ? { ...prev, isDefaultPassword: false } : prev
            );
            notify(
              `Password default berhasil diganti! Akun "${newUsername}" kini terlindungi penuh.`
            );
          }}
          onLogout={() => handleLogout()}
        />
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.business_name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-contain bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {settings.app_name || 'Simple Billing Mini ISP'}
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {settings.business_name || 'Usaha WiFi Anda'}
              </p>
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/70 shrink-0">
                v1.3.0
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <strong className="text-slate-700 dark:text-slate-300">{adminUsername}</strong>
              </span>
              <span>{customers.filter((c) => c.status === 'active').length} aktif</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLogout('Anda telah keluar dari sesi aplikasi.')}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar (Strict 3-Zone Contract on Mobile & Desktop) */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          {/* Zone 1: Brand / Active Page Title */}
          <div className="min-w-0 flex items-center gap-3 shrink-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
              {activeNavMeta.label}
            </span>
          </div>

          {/* Zone 2: Global Instant Search Trigger (Customers & Bills) */}
          <div className="flex-1 max-w-md flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsQuickSearchOpen(true)}
              className="w-full min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 transition-colors"
              aria-label="Cari Cepat Pelanggan atau Tagihan"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">Cari pelanggan atau tagihan...</span>
              </span>
              <span className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Zone 3: Theme Switch & Mobile Logout Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              aria-label="Ganti Tema Terang atau Gelap"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Tema Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">Tema Gelap</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleLogout('Anda telah keluar dari sesi aplikasi.')}
              className="lg:hidden min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              aria-label="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Main Viewport Content (pb-24 on mobile ensures bottom nav never covers content) */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center max-w-md mx-auto my-8">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3">
                Gagal Memuat Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{loadError}</p>
              <button
                type="button"
                onClick={() => fetchAllData()}
                className="mt-4 min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  customers={customers}
                  payments={payments}
                  expenses={expenses}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onChangeMonth={setSelectedMonth}
                  onChangeYear={setSelectedYear}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'customers' && (
                <CustomersView
                  customers={customers}
                  packages={packages}
                  payments={payments}
                  settings={settings}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onImportCustomers={handleImportCustomers}
                  onOpenInvoice={(pay) => setGlobalInvoicePayment(pay)}
                  onNotify={notify}
                />
              )}

              {activeTab === 'billing' && (
                <BillingView
                  payments={payments}
                  customers={customers}
                  settings={settings}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onChangeMonth={setSelectedMonth}
                  onChangeYear={setSelectedYear}
                  onAddPayment={handleAddPayment}
                  onUpdatePayment={handleUpdatePayment}
                  onDeletePayment={handleDeletePayment}
                  onBulkGenerate={handleBulkGeneratePayments}
                  onBulkStatusUpdate={handleBulkUpdatePaymentStatus}
                  onNotify={notify}
                />
              )}

              {activeTab === 'monitoring' && (
                <MonitoringView
                  ownerId={ownerId}
                  customers={customers}
                  settings={settings}
                  onNavigate={setActiveTab}
                  onNotify={notify}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView
                  expenses={expenses}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onChangeMonth={setSelectedMonth}
                  onChangeYear={setSelectedYear}
                  onAddExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onDeleteExpense={handleDeleteExpense}
                  onNotify={notify}
                />
              )}

              {activeTab === 'packages' && (
                <PackagesView
                  packages={packages}
                  customers={customers}
                  onAddPackage={handleAddPackage}
                  onUpdatePackage={handleUpdatePackage}
                  onDeletePackage={handleDeletePackage}
                  onNotify={notify}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  ownerId={ownerId}
                  adminUsername={adminUsername}
                  settings={settings}
                  customers={customers}
                  payments={payments}
                  expenses={expenses}
                  packages={packages}
                  onSaveSettings={handleSaveSettings}
                  onUploadLogo={handleUploadLogo}
                  onRestoreBackup={handleRestoreBackup}
                  onDeleteAccountData={handleDeleteAccountData}
                  onAdminCredentialsChanged={(newUser, newToken) => {
                    setAdminUsername(newUser);
                    setStoredAuthToken(newToken);
                  }}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Quick Search Modal */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        customers={customers}
        payments={payments}
        settings={settings}
        onNavigateToCustomer={() => {
          setActiveTab('customers');
        }}
        onNavigateToPayment={(pay) => {
          setSelectedMonth(String(pay.month).padStart(2, '0'));
          setSelectedYear(Number(pay.year));
          setActiveTab('billing');
        }}
        onOpenInvoice={(pay) => {
          setGlobalInvoicePayment(pay);
        }}
      />

      {/* Global Invoice Modal (Triggered from Header Quick Search or Customer 12-Month History) */}
      <InvoiceModal
        isOpen={Boolean(globalInvoicePayment)}
        onClose={() => setGlobalInvoicePayment(null)}
        payment={globalInvoicePayment}
        customer={
          globalInvoicePayment
            ? customerMap.get(globalInvoicePayment.customer_id)
            : undefined
        }
        settings={settings}
      />

      {/* Mobile Bottom Navigation Bar (with safe area support) */}
      <nav
        aria-label="Navigasi Bawah"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-7 items-center h-16 px-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="text-[9px] sm:text-[10px] tracking-tight mt-1 truncate max-w-full px-0.5">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Non-blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium ${
                t.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {t.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="p-1 text-white/70 hover:text-white"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

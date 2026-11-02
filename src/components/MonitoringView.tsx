import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  ArrowUpDown,
  Wifi,
  WifiOff,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Cpu,
  HardDrive,
  Clock,
  Router,
  MapPin,
  MessageCircle,
  Settings,
  AlertCircle,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  AppSettings,
  Customer,
  MikrotikCustomerMonitorItem,
  MikrotikMonitorResponse,
  NavTab,
} from '../types';
import { api } from '../api';
import { formatBps, formatBytes, normalizeWhatsAppPhone } from '../utils';
import { ConfirmDialog } from './Modal';

interface MonitoringViewProps {
  ownerId: string;
  customers: Customer[];
  settings: AppSettings;
  onNavigate: (tab: NavTab) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type StatusFilter = 'ALL' | 'offline' | 'online' | 'isolated';
type SortOption =
  | 'offline_first'
  | 'online_first'
  | 'rx_desc'
  | 'tx_desc'
  | 'uptime_desc'
  | 'name_asc';

export function MonitoringView({
  ownerId,
  customers,
  settings,
  onNavigate,
  onNotify,
}: MonitoringViewProps) {
  const [monitorData, setMonitorData] = useState<MikrotikMonitorResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('offline_first');

  // Action Confirmation State (Isolate / Unisolate / Kick PPPoE)
  const [pendingAction, setPendingAction] = useState<{
    action: 'isolate' | 'unisolate' | 'kick';
    item: MikrotikCustomerMonitorItem;
  } | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState<boolean>(false);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const isConfigured = Boolean(
    settings.mikrotik_host && settings.mikrotik_host.trim() && settings.mikrotik_user?.trim()
  );

  const fetchSnapshot = useCallback(
    async (silent = false) => {
      if (!isConfigured) return;
      if (!silent) setIsLoading(true);
      setErrorMsg('');
      try {
        const snap = await api.getMikrotikMonitor(ownerId);
        setMonitorData(snap);
      } catch (err: any) {
        setErrorMsg(
          err?.message ||
            'Gagal terhubung ke Router MikroTik. Pastikan IP Publik/VPN Tunnel, Port API, dan kredensial benar.'
        );
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [ownerId, isConfigured]
  );

  useEffect(() => {
    if (isConfigured) {
      fetchSnapshot(false);
    }
  }, [isConfigured, fetchSnapshot]);

  useEffect(() => {
    if (!autoRefresh || !isConfigured) return;
    const timer = setInterval(() => {
      fetchSnapshot(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, isConfigured, fetchSnapshot]);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsExecutingAction(true);
    try {
      const res = await api.executeMikrotikAction(ownerId, {
        action: pendingAction.action,
        username: pendingAction.item.username,
        customer_id: pendingAction.item.customer_id,
      });
      onNotify(res.message || 'Perintah berhasil dikirim ke Router MikroTik.');
      setPendingAction(null);
      await fetchSnapshot(true);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal mengeksekusi perintah pada MikroTik.', 'error');
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    const items = monitorData?.items || [];
    const q = search.trim().toLowerCase();

    const list = items.filter((item) => {
      if (statusFilter === 'online' && (!item.online || item.isolated)) return false;
      if (statusFilter === 'offline' && (item.online || item.isolated)) return false;
      if (statusFilter === 'isolated' && !item.isolated) return false;

      if (!q) return true;
      const cust = item.customer_id ? customerMap.get(item.customer_id) : undefined;
      return (
        item.customer_name.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.ip_address.toLowerCase().includes(q) ||
        item.mac_address.toLowerCase().includes(q) ||
        (cust?.odp_info && cust.odp_info.toLowerCase().includes(q)) ||
        (cust?.address && cust.address.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'offline_first') {
        const score = (x: MikrotikCustomerMonitorItem) =>
          x.isolated ? 1 : !x.online ? 0 : 2;
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        return a.customer_name.localeCompare(b.customer_name, 'id');
      }
      if (sortBy === 'online_first') {
        const score = (x: MikrotikCustomerMonitorItem) =>
          x.online && !x.isolated ? 0 : x.isolated ? 1 : 2;
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        return b.rx_bps - a.rx_bps;
      }
      if (sortBy === 'rx_desc') {
        return (b.rx_bps || 0) - (a.rx_bps || 0);
      }
      if (sortBy === 'tx_desc') {
        return (b.tx_bps || 0) - (a.tx_bps || 0);
      }
      if (sortBy === 'uptime_desc') {
        return (b.uptime || '').localeCompare(a.uptime || '');
      }
      return a.customer_name.localeCompare(b.customer_name, 'id');
    });

    return list;
  }, [monitorData, search, statusFilter, sortBy, customerMap]);

  if (!isConfigured) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 text-center max-w-2xl mx-auto my-4 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <Router className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Koneksi API Router MikroTik Belum Diatur
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Untuk memantau status pelanggan Online/Offline (PPPoE Active, Simple Queue, IP Binding/Netwatch), trafik kecepatan real-time, beban CPU/RAM router, serta fitur Isolir dan Reset Sesi, silakan atur IP Publik / DDNS / VPN Tunnel MikroTik Anda di menu Pengaturan.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Buka Pengaturan MikroTik</span>
          </button>
        </div>
      </div>
    );
  }

  const routerHealth = monitorData?.router;
  const summary = monitorData?.summary || { total: 0, online: 0, offline: 0, isolated: 0 };

  return (
    <div className="space-y-5">
      {/* Router Health & Connection Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Router className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {routerHealth?.identity || settings.mikrotik_host}
                </h2>
                {routerHealth ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Terhubung ({routerHealth.board_name} · v{routerHealth.version})
                  </span>
                ) : (
                  <span className="text-xs font-mono text-slate-500">
                    {settings.mikrotik_host}:{settings.mikrotik_port || 8728}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring PPPoE Active, Simple Queue & IP Binding/Netwatch secara langsung dari MikroTik.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
              <span>Auto-Refresh (10 dtk)</span>
            </label>

            <button
              type="button"
              onClick={() => fetchSnapshot(false)}
              disabled={isLoading}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Memuat...' : 'Segarkan Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              title="Pengaturan Koneksi MikroTik"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Konfigurasi API</span>
            </button>
          </div>
        </div>

        {/* Router System Telemetry & Online/Offline Counters */}
        {routerHealth && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Beban CPU</span>
                <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="font-mono tabular-nums text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                {routerHealth.cpu_load}%
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Memori RAM</span>
                <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="font-mono tabular-nums text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                {routerHealth.memory_used_percent}%
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Uptime Router</span>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <p className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {routerHealth.uptime}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <span>Pelanggan Online</span>
                <Wifi className="w-3.5 h-3.5" />
              </div>
              <p className="font-mono tabular-nums text-base font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {summary.online} Aktif
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                <span>Pelanggan Offline</span>
                <WifiOff className="w-3.5 h-3.5" />
              </div>
              <p className="font-mono tabular-nums text-base font-bold text-rose-700 dark:text-rose-300 mt-1">
                {summary.offline} Putus
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                <span>Terisolir (Disable)</span>
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <p className="font-mono tabular-nums text-base font-bold text-amber-700 dark:text-amber-300 mt-1">
                {summary.isolated} Akun
              </p>
            </div>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Koneksi ke Router MikroTik Gagal</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 self-start sm:self-auto"
            >
              Periksa Pengaturan
            </button>
          </div>
        )}

        {/* Filter & Sort Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pelanggan, username PPPoE/Queue, IP, MAC, atau ODP..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl min-h-[44px]">
              {(
                [
                  { id: 'ALL', label: `Semua (${summary.total})` },
                  { id: 'offline', label: `Offline (${summary.offline})` },
                  { id: 'online', label: `Online (${summary.online})` },
                  { id: 'isolated', label: `Terisolir (${summary.isolated})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none py-2"
                aria-label="Urutkan Monitoring Pelanggan"
              >
                <option value="offline_first" className="bg-white dark:bg-slate-900">
                  Offline / Gangguan Dulu
                </option>
                <option value="online_first" className="bg-white dark:bg-slate-900">
                  Online Aktif Dulu
                </option>
                <option value="rx_desc" className="bg-white dark:bg-slate-900">
                  Trafik Download Tertinggi
                </option>
                <option value="tx_desc" className="bg-white dark:bg-slate-900">
                  Trafik Upload Tertinggi
                </option>
                <option value="uptime_desc" className="bg-white dark:bg-slate-900">
                  Uptime Sesi Terlama
                </option>
                <option value="name_asc" className="bg-white dark:bg-slate-900">
                  Nama Pelanggan (A - Z)
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Monitoring Table / Cards */}
      {isLoading && !monitorData ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Mengambil data sesi PPPoE, Simple Queue, dan Netwatch dari Router MikroTik...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <Activity className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3">
            Tidak Ada Data Monitoring yang Cocok
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Pastikan router MikroTik memiliki daftar PPPoE Secret / Simple Queue / Netwatch atau sesuaikan filter pencarian di atas.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Pelanggan & ODP</th>
                  <th className="py-3.5 px-4">Akun MikroTik & IP</th>
                  <th className="py-3.5 px-4">Status & Uptime</th>
                  <th className="py-3.5 px-4 text-right">Trafik Live (Rx / Tx)</th>
                  <th className="py-3.5 px-4 text-right">Pemakaian Data</th>
                  <th className="py-3.5 px-4 text-right">Kontrol & Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredItems.map((item) => {
                  const cust = item.customer_id ? customerMap.get(item.customer_id) : undefined;
                  const waPhone = cust?.phone ? normalizeWhatsAppPhone(cust.phone) : '';

                  return (
                    <tr
                      key={`${item.source}_${item.username}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.customer_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{item.package_name || cust?.package_name || '-'}</span>
                          {cust?.odp_info && (
                            <>
                              <span>·</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {cust.odp_info}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.username}{' '}
                          <span className="text-[10px] uppercase font-sans font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.source}
                          </span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          IP: {item.ip_address || '-'}
                          {item.mac_address ? ` · MAC: ${item.mac_address}` : ''}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.isolated ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Terisolir (Disabled)
                          </span>
                        ) : item.online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            Offline / Putus
                          </span>
                        )}
                        <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                          Uptime: {item.uptime || '-'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <ArrowDown className="w-3 h-3" />
                          <span>{formatBps(item.rx_bps)}</span>
                        </div>
                        <div className=" flex items-center justify-end gap-1 text-blue-600 dark:text-blue-400 mt-0.5">
                          <ArrowUp className="w-3 h-3" />
                          <span>{formatBps(item.tx_bps)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <p>DL: {formatBytes(item.rx_bytes)}</p>
                        <p className="text-slate-400 mt-0.5">UL: {formatBytes(item.tx_bytes)}</p>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {item.online && (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ action: 'kick', item })}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Reset / Reconnect Sesi PPPoE"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
                          )}

                          {item.isolated ? (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ action: 'unisolate', item })}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Buka Isolir Pelanggan"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Buka Isolir</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ action: 'isolate', item })}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Isolir / Nonaktifkan Koneksi Pelanggan"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Isolir</span>
                            </button>
                          )}

                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                              title="Hubungi Pelanggan via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {cust?.maps_url && (
                            <a
                              href={cust.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                              title="Buka Lokasi Pelanggan di Google Maps"
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map((item) => {
              const cust = item.customer_id ? customerMap.get(item.customer_id) : undefined;
              const waPhone = cust?.phone ? normalizeWhatsAppPhone(cust.phone) : '';

              return (
                <div key={`${item.source}_${item.username}`} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.customer_name}
                      </p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {item.username} ({item.source}) · IP: {item.ip_address || '-'}
                      </p>
                      {cust?.odp_info && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          ODP: {cust.odp_info}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {item.isolated ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Terisolir
                        </span>
                      ) : item.online ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Offline
                        </span>
                      )}
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                        {item.uptime || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Traffic Strip */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block">
                        Kecepatan Download / Upload
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ↓ {formatBps(item.rx_bps)}
                      </span>{' '}
                      /{' '}
                      <span className="text-blue-600 dark:text-blue-400">
                        ↑ {formatBps(item.tx_bps)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-sans text-slate-400 block">
                        Total Pemakaian Data
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {formatBytes(item.rx_bytes + item.tx_bytes)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      {item.isolated ? (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ action: 'unisolate', item })}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Buka Isolir</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ action: 'isolate', item })}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Isolir</span>
                        </button>
                      )}

                      {item.online && (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ action: 'kick', item })}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Sesi</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WA</span>
                        </a>
                      )}
                      {cust?.maps_url && (
                        <a
                          href={cust.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Maps</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for MikroTik Router Control Actions */}
      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        isLoading={isExecutingAction}
        title={
          pendingAction?.action === 'isolate'
            ? 'Konfirmasi Isolir Pelanggan'
            : pendingAction?.action === 'unisolate'
            ? 'Konfirmasi Buka Isolir Pelanggan'
            : 'Konfirmasi Reset Sesi Koneksi'
        }
        confirmLabel={
          pendingAction?.action === 'isolate'
            ? 'Ya, Isolir Sekarang'
            : pendingAction?.action === 'unisolate'
            ? 'Ya, Buka Isolir'
            : 'Ya, Reset Sesi'
        }
        message={
          pendingAction?.action === 'isolate'
            ? `Apakah Anda yakin ingin mengisolir (disable) akun "${pendingAction.item.username}" (${pendingAction.item.customer_name}) di Router MikroTik? Sesi aktif pelanggan juga akan diputus.`
            : pendingAction?.action === 'unisolate'
            ? `Apakah Anda yakin ingin membuka isolir (enable) akun "${pendingAction?.item.username}" (${pendingAction?.item.customer_name}) di Router MikroTik?`
            : `Apakah Anda yakin ingin memutus/mereset sesi aktif "${pendingAction?.item.username}" (${pendingAction?.item.customer_name}) agar perangkat pelanggan melakukan koneksi ulang?`
        }
      />
    </div>
  );
}

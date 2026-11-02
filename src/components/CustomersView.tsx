import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  Edit2,
  Trash2,
  ArrowUpDown,
  Users,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Printer,
  MessageCircle,
  Router,
  Clock,
} from 'lucide-react';
import {
  AppSettings,
  Customer,
  CustomerStatus,
  INDONESIAN_MONTHS,
  Payment,
  WifiPackage,
} from '../types';
import {
  buildWhatsAppUrl,
  downloadCustomerImportTemplateXlsx,
  exportCustomersToXlsx,
  formatDateId,
  formatRupiah,
  parseCustomerImportFile,
} from '../utils';
import { ConfirmDialog, Modal } from './Modal';

interface CustomersViewProps {
  customers: Customer[];
  packages: WifiPackage[];
  payments: Payment[];
  settings: AppSettings;
  onAddCustomer: (c: Omit<Customer, 'id' | 'ownerId'>) => Promise<void>;
  onUpdateCustomer: (id: string, c: Partial<Customer>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onImportCustomers: (items: Partial<Customer>[]) => Promise<{
    importedCount: number;
    failedCount: number;
    errors: { row: number; reason: string }[];
  }>;
  onOpenInvoice: (p: Payment) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type SortField = 'name' | 'monthly_fee' | 'join_date' | 'status' | 'due_day';

export function CustomersView({
  customers,
  packages,
  payments,
  settings,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onImportCustomers,
  onOpenInvoice,
  onNotify,
}: CustomersViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerStatus>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Add/Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [packageName, setPackageName] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<string>('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDay, setDueDay] = useState<number>(10);
  const [pppoeUser, setPppoeUser] = useState('');
  const [odpInfo, setOdpInfo] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [notes, setNotes] = useState('');

  // 12-Month Payment History Modal State
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyYear, setHistoryYear] = useState<number>(() => new Date().getFullYear());

  // Delete Confirmation State
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import XLSX Result Modal State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    failedCount: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const activePackages = useMemo(
    () => packages.filter((p) => p.is_active),
    [packages]
  );

  const availableHistoryYears = useMemo(() => {
    const yrs = new Set<number>([
      new Date().getFullYear() - 1,
      new Date().getFullYear(),
      new Date().getFullYear() + 1,
    ]);
    payments.forEach((p) => yrs.add(Number(p.year)));
    return Array.from(yrs).sort((a, b) => b - a);
  }, [payments]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.package_name.toLowerCase().includes(q) ||
        (c.pppoe_user && c.pppoe_user.toLowerCase().includes(q)) ||
        (c.odp_info && c.odp_info.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'id');
      } else if (sortField === 'monthly_fee') {
        cmp = (Number(a.monthly_fee) || 0) - (Number(b.monthly_fee) || 0);
      } else if (sortField === 'join_date') {
        cmp = (a.join_date || '').localeCompare(b.join_date || '');
      } else if (sortField === 'due_day') {
        cmp = (Number(a.due_day) || 10) - (Number(b.due_day) || 10);
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [customers, search, statusFilter, sortField, sortAsc]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    const defaultPkg = activePackages[0] || packages[0];
    setPackageName(defaultPkg ? defaultPkg.name : '');
    setMonthlyFee(defaultPkg ? String(defaultPkg.price) : '');
    setJoinDate(new Date().toISOString().slice(0, 10));
    setDueDay(10);
    setPppoeUser('');
    setOdpInfo('');
    setMapsUrl('');
    setStatus('active');
    setNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setAddress(cust.address);
    setPackageName(cust.package_name);
    setMonthlyFee(String(cust.monthly_fee));
    setJoinDate(cust.join_date || new Date().toISOString().slice(0, 10));
    setDueDay(cust.due_day || 10);
    setPppoeUser(cust.pppoe_user || '');
    setOdpInfo(cust.odp_info || '');
    setMapsUrl(cust.maps_url || '');
    setStatus(cust.status);
    setNotes(cust.notes || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const handlePackageSelect = (selectedPkgName: string) => {
    setPackageName(selectedPkgName);
    const found = packages.find((p) => p.name === selectedPkgName);
    if (found) {
      setMonthlyFee(String(found.price));
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Nama pelanggan wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Nomor WhatsApp wajib diisi.');
      return;
    }
    if (!packageName.trim()) {
      setFormError('Paket WiFi wajib dipilih atau diisi.');
      return;
    }
    const feeNum = Number(monthlyFee);
    if (monthlyFee === '' || isNaN(feeNum) || feeNum < 0) {
      setFormError('Tarif bulanan wajib berupa angka yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        package_name: packageName.trim(),
        monthly_fee: feeNum,
        join_date: joinDate || new Date().toISOString().slice(0, 10),
        due_day: Math.min(28, Math.max(1, Number(dueDay) || 10)),
        pppoe_user: pppoeUser.trim(),
        odp_info: odpInfo.trim(),
        maps_url: mapsUrl.trim(),
        status,
        notes: notes.trim(),
      };

      if (editingCustomer) {
        await onUpdateCustomer(editingCustomer.id, payload);
        onNotify(`Data pelanggan "${payload.name}" berhasil diperbarui.`);
      } else {
        await onAddCustomer(payload);
        onNotify(`Pelanggan "${payload.name}" berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data pelanggan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    setIsDeleting(true);
    try {
      await onDeleteCustomer(deletingCustomer.id);
      onNotify(`Pelanggan "${deletingCustomer.name}" telah dihapus.`);
      setDeletingCustomer(null);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghapus pelanggan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsImporting(true);
    try {
      const parsedItems = await parseCustomerImportFile(file);
      if (parsedItems.length === 0) {
        onNotify('File Excel kosong atau tidak memiliki baris data pelanggan.', 'error');
        return;
      }
      const res = await onImportCustomers(parsedItems);
      setImportResult(res);
      if (res.importedCount > 0) {
        onNotify(`Berhasil mengimpor ${res.importedCount} pelanggan dari Excel.`);
      } else {
        onNotify('Tidak ada pelanggan yang berhasil diimpor. Periksa laporan validasi.', 'error');
      }
    } catch (err: any) {
      onNotify(err?.message || 'Gagal membaca file Excel (.xlsx).', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Build 12-Month Payment History for Selected Customer & Year
  const customerHistoryMonths = useMemo(() => {
    if (!historyCustomer) return [];
    const custPayments = payments.filter(
      (p) => p.customer_id === historyCustomer.id && Number(p.year) === Number(historyYear)
    );
    const mapByMonth = new Map<string, Payment>();
    custPayments.forEach((p) => {
      mapByMonth.set(String(p.month).padStart(2, '0'), p);
    });

    return INDONESIAN_MONTHS.map((m) => ({
      month: m.value,
      label: m.label,
      short: m.short,
      payment: mapByMonth.get(m.value) || null,
    }));
  }, [historyCustomer, historyYear, payments]);

  return (
    <div className="space-y-5">
      {/* Top Action & Excel Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Daftar Pelanggan WiFi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola kontak, tanggal jatuh tempo, data teknis PPPoE/IP/ODP, titik Maps, dan riwayat 12 bulan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCustomerImportTemplateXlsx}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Template .XLSX</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isImporting ? 'Mengimpor...' : 'Impor .XLSX'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (customers.length === 0) {
                  onNotify('Belum ada data pelanggan untuk diekspor.', 'error');
                  return;
                }
                exportCustomersToXlsx(filteredCustomers);
                onNotify('Data pelanggan berhasil diekspor ke file Excel (.xlsx).');
              }}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Ekspor .XLSX</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pelanggan</span>
            </button>
          </div>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, WA, alamat, paket, username PPPoE/IP, atau ODP..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl min-h-[44px]">
              {(['ALL', 'active', 'inactive'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st === 'active' ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={`${sortField}:${sortAsc ? 'asc' : 'desc'}`}
                onChange={(e) => {
                  const [f, dir] = e.target.value.split(':');
                  setSortField(f as SortField);
                  setSortAsc(dir === 'asc');
                }}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none py-2"
                aria-label="Urutkan Pelanggan"
              >
                <option value="name:asc" className="bg-white dark:bg-slate-900">
                  Nama (A - Z)
                </option>
                <option value="name:desc" className="bg-white dark:bg-slate-900">
                  Nama (Z - A)
                </option>
                <option value="due_day:asc" className="bg-white dark:bg-slate-900">
                  Jatuh Tempo (Tgl Awal)
                </option>
                <option value="monthly_fee:desc" className="bg-white dark:bg-slate-900">
                  Tarif (Tertinggi)
                </option>
                <option value="monthly_fee:asc" className="bg-white dark:bg-slate-900">
                  Tarif (Terendah)
                </option>
                <option value="join_date:desc" className="bg-white dark:bg-slate-900">
                  Terbaru Bergabung
                </option>
                <option value="status:asc" className="bg-white dark:bg-slate-900">
                  Status (Aktif Dulu)
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customer List / Empty State */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4">
            {customers.length === 0
              ? 'Belum Ada Data Pelanggan'
              : 'Pelanggan Tidak Ditemukan'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {customers.length === 0
              ? 'Tambahkan pelanggan pertama Anda secara manual atau impor daftar pelanggan menggunakan file Excel (.xlsx).'
              : 'Coba ubah kata kunci pencarian atau filter status pelanggan di atas.'}
          </p>
          {customers.length === 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pelanggan Baru</span>
              </button>
              <button
                type="button"
                onClick={downloadCustomerImportTemplateXlsx}
                className="min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Unduh Template Excel</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => toggleSort('name')}
                  >
                    Pelanggan & Kontak
                  </th>
                  <th className="py-3.5 px-4">Data Teknis & Alamat</th>
                  <th className="py-3.5 px-4">Paket & Jatuh Tempo</th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => toggleSort('monthly_fee')}
                  >
                    Tarif Bulanan
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => toggleSort('status')}
                  >
                    Status
                  </th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        WA: {c.phone}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                        Gabung: {formatDateId(c.join_date)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs space-y-1">
                      {c.address && <p>{c.address}</p>}
                      {(c.pppoe_user || c.odp_info) && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {c.pppoe_user && (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                              PPPoE/IP: {c.pppoe_user}
                            </span>
                          )}
                          {c.odp_info && (
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                              {c.odp_info}
                            </span>
                          )}
                        </div>
                      )}
                      {c.notes && (
                        <p className="text-slate-400 dark:text-slate-500 truncate max-w-xs">
                          Catatan: {c.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-slate-800 dark:text-slate-200 font-medium">
                        {c.package_name}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        Jatuh Tempo: Tgl {c.due_day || 10}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatRupiah(c.monthly_fee)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          c.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {c.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {c.maps_url && (
                          <a
                            href={c.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title="Buka Titik Lokasi di Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Maps</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setHistoryCustomer(c)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          title="Lihat Riwayat Pembayaran 12 Bulan"
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Riwayat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Pelanggan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCustomer(c)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          title="Hapus Pelanggan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCustomers.map((c) => (
              <div key={c.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {c.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono tabular-nums">{c.phone}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          c.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {c.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100">
                      {formatRupiah(c.monthly_fee)}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Jatuh Tempo: Tgl {c.due_day || 10}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p>
                    Paket: <span className="font-medium">{c.package_name}</span> · Bergabung:{' '}
                    <span className="font-mono tabular-nums">{formatDateId(c.join_date)}</span>
                  </p>
                  {(c.pppoe_user || c.odp_info) && (
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {c.pppoe_user ? `PPPoE/IP: ${c.pppoe_user}` : ''}
                      {c.pppoe_user && c.odp_info ? ' · ' : ''}
                      {c.odp_info ? c.odp_info : ''}
                    </p>
                  )}
                  {c.address && <p className="text-slate-500 dark:text-slate-400">{c.address}</p>}
                  {c.notes && (
                    <p className="text-slate-400 dark:text-slate-500">Catatan: {c.notes}</p>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHistoryCustomer(c)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Riwayat 12 Bln</span>
                    </button>
                    {c.maps_url && (
                      <a
                        href={c.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl inline-flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Maps</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCustomer(c)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-xl inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
        subtitle="Dilengkapi pengaturan tanggal jatuh tempo, data teknis PPPoE/IP MikroTik, dan link lokasi."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Pelanggan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Paket WiFi <span className="text-rose-500">*</span>
              </label>
              {packages.length > 0 ? (
                <select
                  value={packageName}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {!packages.some((p) => p.name === packageName) && packageName && (
                    <option value={packageName}>{packageName}</option>
                  )}
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} ({pkg.speed}) - {formatRupiah(pkg.price)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="Contoh: Paket 20 Mbps"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tarif Bulanan (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="150000"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tgl Jatuh Tempo (1-28)
              </label>
              <select
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Setiap Tanggal {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Technical Network & MikroTik Mapping Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Router className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Data Teknis Jaringan & Sinkronisasi MikroTik</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Username PPPoE / IP Statis / Nama Queue
                </label>
                <input
                  type="text"
                  value={pppoeUser}
                  onChange={(e) => setPppoeUser(e.target.value)}
                  placeholder="Mis. budi-pppoe atau 192.168.10.25"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Info ODP / Port / Perangkat ONT
                </label>
                <input
                  type="text"
                  value={odpInfo}
                  onChange={(e) => setOdpInfo(e.target.value)}
                  placeholder="Mis. ODP-03 Port 4 / ZTE F609"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Pemasangan
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Merdeka No. 10, RT 02/01"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Link Google Maps Lokasi Rumah
              </label>
              <input
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Bergabung
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status Pelanggan <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="active">Aktif (Masuk Tagihan Massal)</option>
                <option value="inactive">Nonaktif (Tidak Ditagih Massal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan Tambahan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mis. Modem dipinjamkan"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pelanggan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 12-Month Payment History Modal */}
      <Modal
        isOpen={Boolean(historyCustomer)}
        onClose={() => setHistoryCustomer(null)}
        title={
          historyCustomer
            ? `Riwayat Pembayaran 12 Bulan — ${historyCustomer.name}`
            : 'Riwayat Pembayaran 12 Bulan'
        }
        subtitle={
          historyCustomer
            ? `Paket: ${historyCustomer.package_name} (${formatRupiah(
                historyCustomer.monthly_fee
              )}/bln) · Jatuh Tempo Tgl ${historyCustomer.due_day || 10}`
            : ''
        }
        maxWidth="max-w-3xl"
      >
        {historyCustomer && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Menampilkan status tagihan bulanan sepanjang tahun{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {historyYear}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Pilih Tahun:</span>
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(Number(e.target.value))}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-mono tabular-nums font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {availableHistoryYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {customerHistoryMonths.map((item) => {
                const pay = item.payment;
                const isPaid = pay?.status === 'lunas';
                const isUnpaid = pay?.status === 'belum_lunas';

                return (
                  <div
                    key={item.month}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                      isPaid
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : isUnpaid
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                        : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {item.label} {historyYear}
                        </span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Lunas
                          </span>
                        ) : isUnpaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Belum Lunas
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Belum Ditagih
                          </span>
                        )}
                      </div>

                      {pay ? (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="font-mono tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatRupiah(pay.amount)}
                          </p>
                          {isPaid && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Dibayar: {formatDateId(pay.payment_date)} ({pay.method || 'Cash'})
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                          Tidak ada tagihan tercatat
                        </p>
                      )}
                    </div>

                    {pay && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-end gap-1.5">
                        <a
                          href={buildWhatsAppUrl(pay, historyCustomer, settings)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WA</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenInvoice(pay);
                          }}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Invoice</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Tutup Riwayat
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Excel Import Summary Modal */}
      <Modal
        isOpen={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title="Hasil Impor Pelanggan (.XLSX)"
        subtitle="Ringkasan validasi baris data dari file Excel yang diunggah"
      >
        {importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Berhasil Diimpor</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-200">
                    {importResult.importedCount} Baris
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Dilewati / Gagal</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-amber-800 dark:text-amber-200">
                    {importResult.failedCount} Baris
                  </p>
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Detail Baris yang Tidak Valid:
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="px-3.5 py-2 flex items-center justify-between gap-2">
                      <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                        Baris #{err.row}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportResult(null)}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Customer Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingCustomer)}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Pelanggan"
        message={`Apakah Anda yakin ingin menghapus pelanggan "${deletingCustomer?.name}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Layers,
  Download,
  Printer,
  MessageCircle,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import {
  AppSettings,
  Customer,
  INDONESIAN_MONTHS,
  Payment,
  PAYMENT_METHODS,
  PaymentMethod,
  PaymentStatus,
} from '../types';
import {
  buildWhatsAppUrl,
  exportPaymentsToXlsx,
  formatDateId,
  formatRupiah,
  getMonthLabel,
  isPaymentOverdue,
} from '../utils';
import { ConfirmDialog, Modal } from './Modal';
import { InvoiceModal } from './InvoiceModal';

interface BillingViewProps {
  payments: Payment[];
  customers: Customer[];
  settings: AppSettings;
  selectedMonth: string; // 'ALL' or '01'..'12'
  selectedYear: number;
  onChangeMonth: (m: string) => void;
  onChangeYear: (y: number) => void;
  onAddPayment: (p: Omit<Payment, 'id' | 'ownerId'>) => Promise<void>;
  onUpdatePayment: (id: string, p: Partial<Payment>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  onBulkGenerate: (payload: {
    month: string;
    year: number;
    customer_ids: string[];
  }) => Promise<{ createdCount: number; skippedCount: number }>;
  onBulkStatusUpdate: (payload: {
    payment_ids: string[];
    status: PaymentStatus;
    method?: string;
    payment_date?: string;
  }) => Promise<{ updatedCount: number }>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type SortField = 'customer_name' | 'amount' | 'status' | 'payment_date';

export function BillingView({
  payments,
  customers,
  settings,
  selectedMonth,
  selectedYear,
  onChangeMonth,
  onChangeYear,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onBulkGenerate,
  onBulkStatusUpdate,
  onNotify,
}: BillingViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PaymentStatus | 'overdue'>('ALL');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortAsc, setSortAsc] = useState(true);

  // Multi-selection for bulk status actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Single Add/Edit Payment Modal
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [singleError, setSingleError] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [billMonth, setBillMonth] = useState(
    selectedMonth === 'ALL'
      ? String(new Date().getMonth() + 1).padStart(2, '0')
      : selectedMonth
  );
  const [billYear, setBillYear] = useState(selectedYear);
  const [status, setStatus] = useState<PaymentStatus>('belum_lunas');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Bulk Bill Generation Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(
    selectedMonth === 'ALL'
      ? String(new Date().getMonth() + 1).padStart(2, '0')
      : selectedMonth
  );
  const [bulkYear, setBulkYear] = useState(selectedYear);
  const [bulkSearch, setBulkSearch] = useState('');
  const [selectedBulkCustomerIds, setSelectedBulkCustomerIds] = useState<string[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  // Quick Mark Paid Modal (with Method selection)
  const [quickPayTarget, setQuickPayTarget] = useState<Payment | null>(null);
  const [quickPayMethod, setQuickPayMethod] = useState<Exclude<PaymentMethod, ''>>('Cash');
  const [quickPayDate, setQuickPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSavingQuickPay, setIsSavingQuickPay] = useState(false);

  // Invoice Preview Modal
  const [invoicePayment, setInvoicePayment] = useState<Payment | null>(null);

  // Delete Confirm Dialog
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([
      new Date().getFullYear() - 1,
      new Date().getFullYear(),
      new Date().getFullYear() + 1,
      selectedYear,
    ]);
    payments.forEach((p) => years.add(Number(p.year)));
    return Array.from(years).sort((a, b) => b - a);
  }, [payments, selectedYear]);

  // Filtered and sorted payments
  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = payments.filter((p) => {
      if (Number(p.year) !== Number(selectedYear)) return false;
      if (selectedMonth !== 'ALL' && String(p.month).padStart(2, '0') !== selectedMonth) {
        return false;
      }
      const cust = customerMap.get(p.customer_id);
      if (statusFilter === 'overdue') {
        if (!isPaymentOverdue(p, cust)) return false;
      } else if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.customer_name.toLowerCase().includes(q) ||
        (p.method && p.method.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'customer_name') {
        cmp = a.customer_name.localeCompare(b.customer_name, 'id');
      } else if (sortField === 'amount') {
        cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (sortField === 'payment_date') {
        cmp = (a.payment_date || '').localeCompare(b.payment_date || '');
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [payments, customerMap, selectedMonth, selectedYear, statusFilter, search, sortField, sortAsc]);

  // Clear selection when period changes
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedMonth, selectedYear, statusFilter]);

  // Summary metrics for current filtered view
  const summaryStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    filteredPayments.forEach((p) => {
      const val = Number(p.amount) || 0;
      total += val;
      if (p.status === 'lunas') paid += val;
      else unpaid += val;
    });
    return { total, paid, unpaid };
  }, [filteredPayments]);

  // Bulk Generation Eligibility Calculation
  const bulkEligibility = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.status === 'active');
    const existingCustomerIds = new Set(
      payments
        .filter(
          (p) =>
            String(p.month).padStart(2, '0') === bulkMonth &&
            Number(p.year) === Number(bulkYear)
        )
        .map((p) => p.customer_id)
    );

    const eligible = activeCustomers.filter((c) => !existingCustomerIds.has(c.id));
    const skippedCount = activeCustomers.length - eligible.length;

    const q = bulkSearch.trim().toLowerCase();
    const visibleEligible = eligible.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.package_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );

    return {
      totalActive: activeCustomers.length,
      eligible,
      visibleEligible,
      skippedCount,
    };
  }, [customers, payments, bulkMonth, bulkYear, bulkSearch]);

  // Automatically select all eligible customers when opening or changing bulk period
  useEffect(() => {
    if (isBulkModalOpen) {
      setSelectedBulkCustomerIds(bulkEligibility.eligible.map((c) => c.id));
    }
  }, [isBulkModalOpen, bulkMonth, bulkYear, bulkEligibility.eligible]);

  const openBulkModal = () => {
    const defaultM =
      selectedMonth === 'ALL'
        ? String(new Date().getMonth() + 1).padStart(2, '0')
        : selectedMonth;
    setBulkMonth(defaultM);
    setBulkYear(selectedYear);
    setBulkSearch('');
    setIsBulkModalOpen(true);
  };

  const handleExecuteBulkGenerate = async () => {
    if (selectedBulkCustomerIds.length === 0) {
      onNotify('Pilih minimal satu pelanggan untuk dibuatkan tagihan.', 'error');
      return;
    }
    setIsGeneratingBulk(true);
    try {
      const res = await onBulkGenerate({
        month: bulkMonth,
        year: bulkYear,
        customer_ids: selectedBulkCustomerIds,
      });
      onChangeMonth(bulkMonth);
      onChangeYear(bulkYear);
      setIsBulkModalOpen(false);
      onNotify(
        `Berhasil membuat ${res.createdCount} tagihan baru untuk periode ${getMonthLabel(
          bulkMonth
        )} ${bulkYear}.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Gagal membuat tagihan massal.', 'error');
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const openAddSingleModal = () => {
    setEditingPayment(null);
    const activeCusts = customers.filter((c) => c.status === 'active');
    const firstCust = activeCusts[0] || customers[0];
    setCustomerId(firstCust ? firstCust.id : '');
    setCustomerName(firstCust ? firstCust.name : '');
    setAmount(firstCust ? String(firstCust.monthly_fee) : '');
    setBillMonth(
      selectedMonth === 'ALL'
        ? String(new Date().getMonth() + 1).padStart(2, '0')
        : selectedMonth
    );
    setBillYear(selectedYear);
    setStatus('belum_lunas');
    setMethod('Cash');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes(firstCust ? `Tagihan Paket ${firstCust.package_name}` : '');
    setSingleError('');
    setIsSingleModalOpen(true);
  };

  const openEditSingleModal = (pay: Payment) => {
    setEditingPayment(pay);
    setCustomerId(pay.customer_id);
    setCustomerName(pay.customer_name);
    setAmount(String(pay.amount));
    setBillMonth(String(pay.month).padStart(2, '0'));
    setBillYear(Number(pay.year));
    setStatus(pay.status);
    setMethod(pay.method || 'Cash');
    setPaymentDate(pay.payment_date || new Date().toISOString().slice(0, 10));
    setNotes(pay.notes || '');
    setSingleError('');
    setIsSingleModalOpen(true);
  };

  const handleCustomerChangeInModal = (id: string) => {
    setCustomerId(id);
    const found = customerMap.get(id);
    if (found) {
      setCustomerName(found.name);
      setAmount(String(found.monthly_fee));
      setNotes(`Tagihan Paket ${found.package_name}`);
    }
  };

  const handleSaveSinglePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError('');
    if (!customerId || !customerName.trim()) {
      setSingleError('Pilih pelanggan terlebih dahulu.');
      return;
    }
    const amtNum = Number(amount);
    if (amount === '' || isNaN(amtNum) || amtNum < 0) {
      setSingleError('Jumlah tagihan harus berupa angka yang valid.');
      return;
    }

    // Prevent duplicate when creating new single bill
    if (!editingPayment) {
      const duplicate = payments.some(
        (p) =>
          p.customer_id === customerId &&
          String(p.month).padStart(2, '0') === billMonth &&
          Number(p.year) === Number(billYear)
      );
      if (duplicate) {
        setSingleError(
          `Pelanggan "${customerName}" sudah memiliki tagihan pada periode ${getMonthLabel(
            billMonth
          )} ${billYear}.`
        );
        return;
      }
    }

    setIsSubmittingSingle(true);
    try {
      const payload = {
        customer_id: customerId,
        customer_name: customerName.trim(),
        amount: amtNum,
        month: billMonth,
        year: Number(billYear),
        status,
        payment_date: status === 'lunas' ? paymentDate : '',
        method: (status === 'lunas' ? method || 'Cash' : '') as PaymentMethod,
        notes: notes.trim(),
      };

      if (editingPayment) {
        await onUpdatePayment(editingPayment.id, payload);
        onNotify(`Tagihan "${payload.customer_name}" berhasil diperbarui.`);
      } else {
        await onAddPayment(payload);
        onNotify(`Tagihan "${payload.customer_name}" berhasil ditambahkan.`);
      }
      setIsSingleModalOpen(false);
    } catch (err: any) {
      setSingleError(err?.message || 'Gagal menyimpan tagihan.');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleTogglePaymentStatus = async (pay: Payment) => {
    if (pay.status === 'belum_lunas') {
      // Open quick pay dialog to confirm method & date
      setQuickPayTarget(pay);
      setQuickPayMethod((pay.method as Exclude<PaymentMethod, ''>) || 'Cash');
      setQuickPayDate(new Date().toISOString().slice(0, 10));
    } else {
      // Revert to belum_lunas
      try {
        await onUpdatePayment(pay.id, {
          status: 'belum_lunas',
          payment_date: '',
          method: '',
        });
        onNotify(`Status tagihan "${pay.customer_name}" diubah menjadi Belum Lunas.`);
      } catch (err: any) {
        onNotify(err?.message || 'Gagal mengubah status.', 'error');
      }
    }
  };

  const handleConfirmQuickPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayTarget) return;
    setIsSavingQuickPay(true);
    try {
      await onUpdatePayment(quickPayTarget.id, {
        status: 'lunas',
        method: quickPayMethod,
        payment_date: quickPayDate || new Date().toISOString().slice(0, 10),
      });
      onNotify(`Pembayaran "${quickPayTarget.customer_name}" berhasil dicatat LUNAS.`);
      setQuickPayTarget(null);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal mencatat pembayaran.', 'error');
    } finally {
      setIsSavingQuickPay(false);
    }
  };

  const handleBulkStatusAction = async (targetStatus: PaymentStatus) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await onBulkStatusUpdate({
        payment_ids: selectedIds,
        status: targetStatus,
        method: targetStatus === 'lunas' ? 'Cash' : '',
        payment_date: targetStatus === 'lunas' ? new Date().toISOString().slice(0, 10) : '',
      });
      setSelectedIds([]);
      onNotify(
        `Berhasil memperbarui status ${res.updatedCount} tagihan menjadi ${
          targetStatus === 'lunas' ? 'LUNAS' : 'BELUM LUNAS'
        }.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Gagal mengubah status massal.', 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPayment) return;
    setIsDeleting(true);
    try {
      await onDeletePayment(deletingPayment.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deletingPayment.id));
      onNotify(`Tagihan "${deletingPayment.customer_name}" berhasil dihapus.`);
      setDeletingPayment(null);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghapus tagihan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPayments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPayments.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const periodLabel =
    selectedMonth === 'ALL'
      ? `Tahun_${selectedYear}`
      : `${getMonthLabel(selectedMonth)}_${selectedYear}`;

  return (
    <div className="space-y-5">
      {/* Top Action & Filter Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tagihan & Pembayaran WiFi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola tagihan bulanan, catat pelunasan, kirim pengingat WhatsApp, dan cetak invoice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openBulkModal}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Layers className="w-4 h-4" />
              <span>Buat Tagihan Massal</span>
            </button>

            <button
              type="button"
              onClick={openAddSingleModal}
              className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tagihan Satuan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (filteredPayments.length === 0) {
                  onNotify('Tidak ada data tagihan pada periode ini untuk diekspor.', 'error');
                  return;
                }
                exportPaymentsToXlsx(filteredPayments, periodLabel);
                onNotify('Data tagihan berhasil diekspor ke file Excel (.xlsx).');
              }}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor .XLSX</span>
            </button>
          </div>
        </div>

        {/* Period & Search Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pelanggan, metode bayar, catatan..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-8 flex flex-wrap items-center justify-between md:justify-end gap-2">
            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none py-2"
                aria-label="Filter Bulan Tagihan"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900">
                  Semua Bulan
                </option>
                {INDONESIAN_MONTHS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-white dark:bg-slate-900">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <select
                value={selectedYear}
                onChange={(e) => onChangeYear(Number(e.target.value))}
                className="bg-transparent text-xs sm:text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 focus:outline-none py-2"
                aria-label="Filter Tahun Tagihan"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-slate-900">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl min-h-[44px]">
              {(['ALL', 'belum_lunas', 'overdue', 'lunas'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Semua'
                    : st === 'lunas'
                    ? 'Lunas'
                    : st === 'overdue'
                    ? 'Menunggak'
                    : 'Belum Lunas'}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 min-h-[44px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={`${sortField}:${sortAsc ? 'asc' : 'desc'}`}
                onChange={(e) => {
                  const [f, dir] = e.target.value.split(':');
                  setSortField(f as SortField);
                  setSortAsc(dir === 'asc');
                }}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none py-2"
                aria-label="Urutkan Tagihan"
              >
                <option value="status:asc" className="bg-white dark:bg-slate-900">
                  Belum Lunas Dulu
                </option>
                <option value="status:desc" className="bg-white dark:bg-slate-900">
                  Lunas Dulu
                </option>
                <option value="customer_name:asc" className="bg-white dark:bg-slate-900">
                  Nama (A - Z)
                </option>
                <option value="amount:desc" className="bg-white dark:bg-slate-900">
                  Tagihan Tertinggi
                </option>
                <option value="payment_date:desc" className="bg-white dark:bg-slate-900">
                  Tanggal Bayar Terbaru
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Period Totals Strip */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Total Tagihan:</span>
            <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 sm:text-sm mt-0.5">
              {formatRupiah(summaryStats.total)}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Sudah Lunas:</span>
            <p className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 sm:text-sm mt-0.5">
              {formatRupiah(summaryStats.paid)}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Belum Lunas:</span>
            <p className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 sm:text-sm mt-0.5">
              {formatRupiah(summaryStats.unpaid)}
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Select Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-blue-950 text-white rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            <span className="font-mono tabular-nums font-bold text-blue-400">
              {selectedIds.length}
            </span>
            <span>tagihan dipilih</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBulkUpdating}
              onClick={() => handleBulkStatusAction('lunas')}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tandai Lunas Massal</span>
            </button>
            <button
              type="button"
              disabled={isBulkUpdating}
              onClick={() => handleBulkStatusAction('belum_lunas')}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Clock className="w-4 h-4" />
              <span>Tandai Belum Lunas</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Payments Table / List */}
      {filteredPayments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4">
            Belum Ada Tagihan pada Periode Ini
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Gunakan fitur Buat Tagihan Massal untuk menerbitkan tagihan seluruh pelanggan aktif secara otomatis tanpa duplikat.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openBulkModal}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-2 transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Buat Tagihan Massal</span>
            </button>
            <button
              type="button"
              onClick={openAddSingleModal}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tagihan Satuan</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      aria-label="Pilih semua tagihan"
                    >
                      {selectedIds.length === filteredPayments.length &&
                      filteredPayments.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Pelanggan</th>
                  <th className="py-3.5 px-4">Periode</th>
                  <th className="py-3.5 px-4 text-right">Jumlah</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Tgl Bayar & Metode</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredPayments.map((pay) => {
                  const cust = customerMap.get(pay.customer_id);
                  const waUrl = buildWhatsAppUrl(pay, cust, settings);
                  const isChecked = selectedIds.includes(pay.id);
                  const overdue = isPaymentOverdue(pay, cust);
                  const dueDay = cust?.due_day || 10;

                  return (
                    <tr
                      key={pay.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isChecked ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(pay.id)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500"
                          aria-label={`Pilih tagihan ${pay.customer_name}`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {pay.customer_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {cust?.package_name || pay.notes || 'Layanan WiFi'}
                          {cust?.phone ? ` · ${cust.phone}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-slate-700 dark:text-slate-300 font-medium">
                          {getMonthLabel(pay.month)} {pay.year}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                          Jatuh tempo tgl {dueDay}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatRupiah(pay.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentStatus(pay)}
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              pay.status === 'lunas'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : overdue
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                            title="Klik untuk mengubah status pembayaran"
                          >
                            {pay.status === 'lunas' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lunas</span>
                              </>
                            ) : overdue ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Menunggak</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Belum Lunas</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {pay.status === 'lunas' ? (
                          <div>
                            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                              {formatDateId(pay.payment_date)}
                            </p>
                            <p className="text-slate-500">{pay.method || 'Cash'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title={
                              pay.status === 'lunas'
                                ? 'Kirim Konfirmasi Lunas via WhatsApp'
                                : 'Kirim Pengingat Tagihan via WhatsApp'
                            }
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => setInvoicePayment(pay)}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title="Lihat & Cetak Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditSingleModal(pay)}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Tagihan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingPayment(pay)}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Hapus Tagihan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card List */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPayments.map((pay) => {
              const cust = customerMap.get(pay.customer_id);
              const waUrl = buildWhatsAppUrl(pay, cust, settings);
              const isChecked = selectedIds.includes(pay.id);
              const overdue = isPaymentOverdue(pay, cust);
              const dueDay = cust?.due_day || 10;

              return (
                <div
                  key={pay.id}
                  className={`p-4 space-y-3 ${
                    isChecked ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(pay.id)}
                        className="min-h-[40px] min-w-[40px] -ml-2 -mt-1 flex items-center justify-center text-slate-500 shrink-0"
                        aria-label={`Pilih ${pay.customer_name}`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {pay.customer_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {getMonthLabel(pay.month)} {pay.year} · Jatuh tempo tgl {dueDay} ·{' '}
                          {cust?.package_name || pay.notes || 'WiFi'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatRupiah(pay.amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-0.5 ${
                          pay.status === 'lunas'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : overdue
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {pay.status === 'lunas'
                          ? 'Lunas'
                          : overdue
                          ? 'Menunggak'
                          : 'Belum Lunas'}
                      </p>
                    </div>
                  </div>

                  {pay.status === 'lunas' && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 pl-8">
                      Dibayar: <span className="font-mono tabular-nums">{formatDateId(pay.payment_date)}</span> · Metode:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {pay.method || 'Cash'}
                      </span>
                    </div>
                  )}

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePaymentStatus(pay)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                        pay.status === 'lunas'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {pay.status === 'lunas' ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Batalkan Lunas</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Catat Lunas</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WA</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setInvoicePayment(pay)}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Invoice</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditSingleModal(pay)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        aria-label="Edit tagihan"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingPayment(pay)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                        aria-label="Hapus tagihan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Bill Generation Modal (Anti-Duplicate) */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Buat Tagihan Massal"
        subtitle="Otomatis melewati pelanggan nonaktif dan pelanggan yang sudah memiliki tagihan di periode yang sama."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Period Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bulan Tagihan
              </label>
              <select
                value={bulkMonth}
                onChange={(e) => setBulkMonth(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {INDONESIAN_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tahun Tagihan
              </label>
              <select
                value={bulkYear}
                onChange={(e) => setBulkYear(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Eligibility & Anti-Duplicate Summary Banner */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                Pelanggan Aktif Memenuhi Syarat:
              </span>
              <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {bulkEligibility.eligible.length} Pelanggan
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                Dilewati (Tagihan Sudah Ada):
              </span>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-0.5">
                {bulkEligibility.skippedCount} Pelanggan
              </p>
            </div>
          </div>

          {/* Search & Selection Controls */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  placeholder="Cari nama atau paket pelanggan..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              {bulkEligibility.eligible.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBulkCustomerIds(bulkEligibility.eligible.map((c) => c.id))
                    }
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Pilih Semua ({bulkEligibility.eligible.length})
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBulkCustomerIds([])}
                    className="font-medium text-slate-500 hover:underline"
                  >
                    Kosongkan
                  </button>
                </div>
              )}
            </div>

            {bulkEligibility.eligible.length === 0 ? (
              <div className="p-6 text-center border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                Semua pelanggan aktif ({bulkEligibility.totalActive} pelanggan) sudah memiliki tagihan pada periode{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {getMonthLabel(bulkMonth)} {bulkYear}
                </span>
                .
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {bulkEligibility.visibleEligible.map((cust) => {
                  const checked = selectedBulkCustomerIds.includes(cust.id);
                  return (
                    <label
                      key={cust.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedBulkCustomerIds((prev) =>
                              prev.includes(cust.id)
                                ? prev.filter((id) => id !== cust.id)
                                : [...prev, cust.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {cust.name}
                          </p>
                          <p className="text-slate-500 truncate">{cust.package_name}</p>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        {formatRupiah(cust.monthly_fee)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Terpilih:{' '}
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {selectedBulkCustomerIds.length}
              </strong>{' '}
              pelanggan
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isGeneratingBulk || selectedBulkCustomerIds.length === 0}
                onClick={handleExecuteBulkGenerate}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
              >
                {isGeneratingBulk
                  ? 'Membuat Tagihan...'
                  : `Terbitkan ${selectedBulkCustomerIds.length} Tagihan`}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Mark Paid Modal */}
      <Modal
        isOpen={Boolean(quickPayTarget)}
        onClose={() => setQuickPayTarget(null)}
        title="Catat Pembayaran Lunas"
        subtitle={
          quickPayTarget
            ? `${quickPayTarget.customer_name} · Periode ${getMonthLabel(quickPayTarget.month)} ${
                quickPayTarget.year
              }`
            : ''
        }
        maxWidth="max-w-md"
      >
        {quickPayTarget && (
          <form onSubmit={handleConfirmQuickPay} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Nominal Diterima</span>
              <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatRupiah(quickPayTarget.amount)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Metode Pembayaran
              </label>
              <select
                value={quickPayMethod}
                onChange={(e) => setQuickPayMethod(e.target.value as Exclude<PaymentMethod, ''>)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Pembayaran
              </label>
              <input
                type="date"
                required
                value={quickPayDate}
                onChange={(e) => setQuickPayDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingQuickPay}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl"
              >
                {isSavingQuickPay ? 'Menyimpan...' : 'Simpan Lunas'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Single Add / Edit Payment Modal */}
      <Modal
        isOpen={isSingleModalOpen}
        onClose={() => setIsSingleModalOpen(false)}
        title={editingPayment ? 'Edit Tagihan & Pembayaran' : 'Buat Tagihan Satuan'}
      >
        <form onSubmit={handleSaveSinglePayment} className="space-y-4">
          {singleError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-600 dark:text-rose-300">
              {singleError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pelanggan <span className="text-rose-500">*</span>
            </label>
            {customers.length > 0 ? (
              <select
                value={customerId}
                onChange={(e) => handleCustomerChangeInModal(e.target.value)}
                disabled={Boolean(editingPayment)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.package_name} ({formatRupiah(c.monthly_fee)})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-rose-600">
                Belum ada pelanggan terdaftar. Tambahkan pelanggan terlebih dahulu.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bulan <span className="text-rose-500">*</span>
              </label>
              <select
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {INDONESIAN_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tahun <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={billYear}
                onChange={(e) => setBillYear(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jumlah Tagihan (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status Pembayaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="belum_lunas">Belum Lunas</option>
                <option value="lunas">Lunas</option>
              </select>
            </div>
          </div>

          {status === 'lunas' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tagihan atau pembayaran"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSingleModalOpen(false)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingSingle || customers.length === 0}
              className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
            >
              {isSubmittingSingle ? 'Menyimpan...' : 'Simpan Tagihan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Preview Modal */}
      <InvoiceModal
        isOpen={Boolean(invoicePayment)}
        onClose={() => setInvoicePayment(null)}
        payment={invoicePayment}
        customer={invoicePayment ? customerMap.get(invoicePayment.customer_id) : undefined}
        settings={settings}
      />

      {/* Delete Payment Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Tagihan"
        message={`Apakah Anda yakin ingin menghapus tagihan "${
          deletingPayment?.customer_name
        }" untuk periode ${
          deletingPayment ? `${getMonthLabel(deletingPayment.month)} ${deletingPayment.year}` : ''
        }?`}
      />
    </div>
  );
}

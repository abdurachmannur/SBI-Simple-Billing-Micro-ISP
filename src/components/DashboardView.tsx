import React, { useMemo, useState } from 'react';
import {
  Users,
  Receipt,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Wallet,
  Calendar,
  ArrowRight,
  Plus,
} from 'lucide-react';
import {
  Customer,
  Expense,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  INDONESIAN_MONTHS,
  NavTab,
  Payment,
} from '../types';
import { formatRupiah, getMonthLabel, getMonthShortLabel } from '../utils';

interface DashboardViewProps {
  customers: Customer[];
  payments: Payment[];
  expenses: Expense[];
  selectedMonth: string; // 'ALL' or '01'..'12'
  selectedYear: number;
  onChangeMonth: (m: string) => void;
  onChangeYear: (y: number) => void;
  onNavigate: (tab: NavTab) => void;
}

const CATEGORY_COLORS: Record<ExpenseCategory, { bar: string; text: string; hex: string }> = {
  Operasional: {
    bar: 'bg-blue-600 dark:bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    hex: '#2563EB',
  },
  Maintenance: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    hex: '#F59E0B',
  },
  Perangkat: {
    bar: 'bg-purple-600 dark:bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    hex: '#9333EA',
  },
  'Internet/ISP': {
    bar: 'bg-emerald-600 dark:bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    hex: '#059669',
  },
  Listrik: {
    bar: 'bg-rose-600 dark:bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    hex: '#E11D48',
  },
  Lainnya: {
    bar: 'bg-slate-600 dark:bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    hex: '#64748B',
  },
};

export function DashboardView({
  customers,
  payments,
  expenses,
  selectedMonth,
  selectedYear,
  onChangeMonth,
  onChangeYear,
  onNavigate,
}: DashboardViewProps) {
  const [trendRange, setTrendRange] = useState<6 | 12>(6);

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear(), selectedYear]);
    payments.forEach((p) => years.add(Number(p.year)));
    expenses.forEach((e) => {
      const y = Number(e.expense_date?.slice(0, 4));
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [payments, expenses, selectedYear]);

  // Customer counts
  const activeCustomersCount = useMemo(
    () => customers.filter((c) => c.status === 'active').length,
    [customers]
  );
  const inactiveCustomersCount = useMemo(
    () => customers.filter((c) => c.status === 'inactive').length,
    [customers]
  );

  // Filtered payments & expenses for current selected period
  const periodPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchYear = Number(p.year) === Number(selectedYear);
      const matchMonth =
        selectedMonth === 'ALL' || String(p.month).padStart(2, '0') === selectedMonth;
      return matchYear && matchMonth;
    });
  }, [payments, selectedMonth, selectedYear]);

  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.expense_date) return false;
      const [y, m] = e.expense_date.slice(0, 10).split('-');
      const matchYear = Number(y) === Number(selectedYear);
      const matchMonth = selectedMonth === 'ALL' || m === selectedMonth;
      return matchYear && matchMonth;
    });
  }, [expenses, selectedMonth, selectedYear]);

  // Core Financial Logic (Strict adherence to specification)
  const totalBilled = useMemo(
    () => periodPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [periodPayments]
  );

  const paidPayments = useMemo(
    () => periodPayments.filter((p) => p.status === 'lunas'),
    [periodPayments]
  );
  const unpaidPayments = useMemo(
    () => periodPayments.filter((p) => p.status === 'belum_lunas'),
    [periodPayments]
  );

  const totalReceived = useMemo(
    () => paidPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [paidPayments]
  );

  const totalUnpaid = useMemo(
    () => unpaidPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [unpaidPayments]
  );

  const totalExpenses = useMemo(
    () => periodExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0),
    [periodExpenses]
  );

  // Selisih = Pembayaran Lunas - Total Pengeluaran
  const netBalance = totalReceived - totalExpenses;

  // Monthly breakdown for selectedYear
  const monthlySummary = useMemo(() => {
    return INDONESIAN_MONTHS.map((m) => {
      const mPayments = payments.filter(
        (p) =>
          Number(p.year) === Number(selectedYear) &&
          String(p.month).padStart(2, '0') === m.value
      );
      const mExpenses = expenses.filter((e) => {
        if (!e.expense_date) return false;
        const [y, em] = e.expense_date.slice(0, 10).split('-');
        return Number(y) === Number(selectedYear) && em === m.value;
      });

      const billed = mPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const paid = mPayments
        .filter((p) => p.status === 'lunas')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const unpaid = mPayments
        .filter((p) => p.status === 'belum_lunas')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const expenseTotal = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const diff = paid - expenseTotal;

      return {
        month: m.value,
        label: m.label,
        short: m.short,
        billed,
        paid,
        unpaid,
        expenseTotal,
        diff,
        countBills: mPayments.length,
        countUnpaid: mPayments.filter((p) => p.status === 'belum_lunas').length,
      };
    });
  }, [payments, expenses, selectedYear]);

  // Expense breakdown by category for the selected period
  const categoryBreakdown = useMemo(() => {
    const totals: Record<ExpenseCategory, number> = {
      Operasional: 0,
      Maintenance: 0,
      Perangkat: 0,
      'Internet/ISP': 0,
      Listrik: 0,
      Lainnya: 0,
    };
    periodExpenses.forEach((e) => {
      const cat = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'Lainnya';
      totals[cat] += Number(e.amount) || 0;
    });
    return EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      amount: totals[cat],
      percentage: totalExpenses > 0 ? Math.round((totals[cat] / totalExpenses) * 100) : 0,
    }));
  }, [periodExpenses, totalExpenses]);

  // Trend of expenses per category over time (last N months up to selected month/year)
  const trendData = useMemo(() => {
    const anchorMonth =
      selectedMonth === 'ALL' ? new Date().getMonth() + 1 : Number(selectedMonth);
    const anchorYear = Number(selectedYear);

    const periods: { month: string; year: number; label: string }[] = [];
    for (let i = trendRange - 1; i >= 0; i--) {
      let m = anchorMonth - i;
      let y = anchorYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const mStr = String(m).padStart(2, '0');
      periods.push({
        month: mStr,
        year: y,
        label: `${getMonthShortLabel(mStr)} ${String(y).slice(-2)}`,
      });
    }

    return periods.map((per) => {
      const perExpenses = expenses.filter((e) => {
        if (!e.expense_date) return false;
        const [ey, em] = e.expense_date.slice(0, 10).split('-');
        return Number(ey) === per.year && em === per.month;
      });
      const byCategory: Record<ExpenseCategory, number> = {
        Operasional: 0,
        Maintenance: 0,
        Perangkat: 0,
        'Internet/ISP': 0,
        Listrik: 0,
        Lainnya: 0,
      };
      let total = 0;
      perExpenses.forEach((e) => {
        const cat = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'Lainnya';
        const val = Number(e.amount) || 0;
        byCategory[cat] += val;
        total += val;
      });
      return {
        ...per,
        byCategory,
        total,
      };
    });
  }, [expenses, selectedMonth, selectedYear, trendRange]);

  const maxTrendTotal = useMemo(() => {
    const m = Math.max(...trendData.map((d) => d.total), 0);
    return m > 0 ? m : 1000000;
  }, [trendData]);

  const periodTitle =
    selectedMonth === 'ALL'
      ? `Tahun ${selectedYear}`
      : `${getMonthLabel(selectedMonth)} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Ringkasan Kinerja & Keuangan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Menampilkan data untuk periode <span className="font-semibold text-slate-700 dark:text-slate-200">{periodTitle}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => onChangeMonth(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none py-2 pr-1"
              aria-label="Filter Bulan"
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
              className="bg-transparent text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 focus:outline-none py-2"
              aria-label="Filter Tahun"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="bg-white dark:bg-slate-900">
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (6 Core Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Pelanggan Aktif & Nonaktif */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Status Pelanggan WiFi
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {activeCustomersCount}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Aktif
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-sm font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-400">
              {inactiveCustomersCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Nonaktif</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Total terdaftar: {customers.length} pelanggan</span>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Kelola <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 2. Total Tagihan (Diterbitkan) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Tagihan Diterbitkan
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatRupiah(totalBilled)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{periodPayments.length} tagihan pada periode ini</span>
            <span>Lunas + Belum Lunas</span>
          </div>
        </div>

        {/* 3. Pembayaran Diterima (Lunas) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pembayaran Sudah Diterima (Lunas)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatRupiah(totalReceived)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{paidPayments.length} pelanggan sudah membayar</span>
            <span className="font-mono tabular-nums">
              {totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0}% tertagih
            </span>
          </div>
        </div>

        {/* 4. Tagihan Belum Lunas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tagihan Belum Lunas (Piutang)
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatRupiah(totalUnpaid)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{unpaidPayments.length} tagihan menunggu bayar</span>
            <button
              type="button"
              onClick={() => onNavigate('billing')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Tagih WA <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 5. Total Pengeluaran */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Pengeluaran
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatRupiah(totalExpenses)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{periodExpenses.length} transaksi pengeluaran</span>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Catat <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 6. Selisih Pemasukan Lunas terhadap Pengeluaran */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Selisih Kas (Pemasukan Lunas - Pengeluaran)
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p
              className={`text-2xl font-bold font-mono tabular-nums ${
                netBalance >= 0
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netBalance < 0 ? '-' : ''}
              {formatRupiah(Math.abs(netBalance))}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tagihan belum lunas tidak dihitung pemasukan</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Pengeluaran per Kategori */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pengeluaran per Kategori
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribusi biaya periode {periodTitle}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                {formatRupiah(totalExpenses)}
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {categoryBreakdown.map((item) => {
                const style = CATEGORY_COLORS[item.category];
                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatRupiah(item.amount)}
                        </span>
                        <span className="text-slate-400 w-9 text-right">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${style.bar}`}
                        style={{ width: `${Math.max(item.amount > 0 ? 4 : 0, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>6 Kategori Standar Operasional</span>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Tambah Pengeluaran <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Grafik Tren Pengeluaran per Kategori dari Waktu ke Waktu */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tren Pengeluaran per Kategori
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbandingan biaya operasional dari waktu ke waktu
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTrendRange(6)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    trendRange === 6
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  6 Bulan
                </button>
                <button
                  type="button"
                  onClick={() => setTrendRange(12)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    trendRange === 12
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  12 Bulan
                </button>
              </div>
            </div>

            {/* Stacked Bar Chart */}
            <div className="mt-6 pt-2">
              <div className="h-52 flex items-end justify-between gap-2 sm:gap-3 border-b border-slate-200 dark:border-slate-800 pb-2 px-1">
                {trendData.map((col) => {
                  const totalHeightPct =
                    col.total > 0 ? Math.max(8, Math.round((col.total / maxTrendTotal) * 100)) : 0;

                  return (
                    <div
                      key={`${col.year}-${col.month}`}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute bottom-full mb-2 z-20 w-44 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-lg">
                        <p className="font-bold border-b border-slate-700 pb-1 mb-1">
                          {getMonthLabel(col.month)} {col.year}
                        </p>
                        {EXPENSE_CATEGORIES.map((cat) =>
                          col.byCategory[cat] > 0 ? (
                            <div key={cat} className="flex justify-between py-0.5">
                              <span className="text-slate-300">{cat}:</span>
                              <span className="font-mono tabular-nums">
                                {formatRupiah(col.byCategory[cat])}
                              </span>
                            </div>
                          ) : null
                        )}
                        <div className="flex justify-between pt-1 mt-1 border-t border-slate-700 font-bold">
                          <span>Total:</span>
                          <span className="font-mono tabular-nums">{formatRupiah(col.total)}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-1 hidden sm:block">
                        {col.total > 0 ? `${Math.round(col.total / 1000)}k` : '0'}
                      </span>

                      <div
                        className="w-full max-w-[38px] rounded-t-lg overflow-hidden flex flex-col-reverse bg-slate-100 dark:bg-slate-800/50 transition-all duration-300"
                        style={{ height: `${totalHeightPct || 4}%` }}
                      >
                        {col.total > 0
                          ? EXPENSE_CATEGORIES.map((cat) => {
                              const val = col.byCategory[cat];
                              if (val <= 0) return null;
                              const segPct = (val / col.total) * 100;
                              return (
                                <div
                                  key={cat}
                                  style={{
                                    height: `${segPct}%`,
                                    backgroundColor: CATEGORY_COLORS[cat].hex,
                                  }}
                                />
                              );
                            })
                          : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div className="flex items-center justify-between gap-2 sm:gap-3 pt-2 px-1">
                {trendData.map((col) => (
                  <div key={`lbl-${col.year}-${col.month}`} className="flex-1 text-center">
                    <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {EXPENSE_CATEGORIES.map((cat) => (
              <div key={cat} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat].hex }}
                />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ringkasan Keuangan Bulanan & Informasi Tagihan Belum Lunas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ringkasan Keuangan & Pendapatan Bulanan ({selectedYear})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selisih dihitung dari Pembayaran Lunas dikurangi Total Pengeluaran. Total Tagihan ditampilkan terpisah.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            Buka Daftar Tagihan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Bulan</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4 text-right">Pendapatan Lunas</th>
                <th className="py-3 px-4 text-right">Tagihan Belum Lunas</th>
                <th className="py-3 px-4 text-right">Total Pengeluaran</th>
                <th className="py-3 px-4 text-right">Selisih (Lunas - Pengeluaran)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
              {monthlySummary.map((row) => {
                const isSelected = selectedMonth === row.month;
                return (
                  <tr
                    key={row.month}
                    onClick={() => onChangeMonth(row.month)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      isSelected ? 'bg-blue-50/50 dark:bg-blue-950/25' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{row.label}</span>
                        {row.countUnpaid > 0 && (
                          <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                            · {row.countUnpaid} belum lunas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatRupiah(row.billed)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatRupiah(row.paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatRupiah(row.unpaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {formatRupiah(row.expenseTotal)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        row.diff >= 0
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {row.diff < 0 ? '-' : ''}
                      {formatRupiah(Math.abs(row.diff))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

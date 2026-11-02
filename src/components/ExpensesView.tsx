import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import {
  Expense,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  INDONESIAN_MONTHS,
} from '../types';
import { formatDateId, formatRupiah, getMonthLabel } from '../utils';
import { ConfirmDialog, Modal } from './Modal';

interface ExpensesViewProps {
  expenses: Expense[];
  selectedMonth: string; // 'ALL' or '01'..'12'
  selectedYear: number;
  onChangeMonth: (m: string) => void;
  onChangeYear: (y: number) => void;
  onAddExpense: (e: Omit<Expense, 'id' | 'ownerId'>) => Promise<void>;
  onUpdateExpense: (id: string, e: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function ExpensesView({
  expenses,
  selectedMonth,
  selectedYear,
  onChangeMonth,
  onChangeYear,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onNotify,
}: ExpensesViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ExpenseCategory>('ALL');

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Operasional');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Delete Confirm State
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear(), selectedYear]);
    expenses.forEach((e) => {
      const y = Number(e.expense_date?.slice(0, 4));
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses, selectedYear]);

  // Period filtered expenses (before category filter, for category summary cards)
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.expense_date) return false;
      const [y, m] = e.expense_date.slice(0, 10).split('-');
      if (Number(y) !== Number(selectedYear)) return false;
      if (selectedMonth !== 'ALL' && m !== selectedMonth) return false;
      return true;
    });
  }, [expenses, selectedMonth, selectedYear]);

  // Filtered by search + category
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = periodExpenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
    return list;
  }, [periodExpenses, categoryFilter, search]);

  const totalPeriodExpense = useMemo(
    () => periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [periodExpenses]
  );

  const totalFilteredExpense = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const categoryTotals = useMemo(() => {
    const map: Record<ExpenseCategory, number> = {
      Operasional: 0,
      Maintenance: 0,
      Perangkat: 0,
      'Internet/ISP': 0,
      Listrik: 0,
      Lainnya: 0,
    };
    periodExpenses.forEach((e) => {
      const cat = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'Lainnya';
      map[cat] += Number(e.amount) || 0;
    });
    return map;
  }, [periodExpenses]);

  const openAddModal = () => {
    setEditingExpense(null);
    setDescription('');
    setAmount('');
    setCategory(categoryFilter === 'ALL' ? 'Operasional' : categoryFilter);
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setDescription(exp.description);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setExpenseDate(exp.expense_date || new Date().toISOString().slice(0, 10));
    setNotes(exp.notes || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!description.trim()) {
      setFormError('Keterangan pengeluaran wajib diisi.');
      return;
    }
    const amtNum = Number(amount);
    if (amount === '' || isNaN(amtNum) || amtNum <= 0) {
      setFormError('Jumlah pengeluaran harus lebih dari 0.');
      return;
    }
    if (!expenseDate) {
      setFormError('Tanggal pengeluaran wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        description: description.trim(),
        amount: amtNum,
        category,
        expense_date: expenseDate,
        notes: notes.trim(),
      };
      if (editingExpense) {
        await onUpdateExpense(editingExpense.id, payload);
        onNotify(`Pengeluaran "${payload.description}" berhasil diperbarui.`);
      } else {
        await onAddExpense(payload);
        onNotify(`Pengeluaran "${payload.description}" berhasil dicatat.`);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan pengeluaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      await onDeleteExpense(deletingExpense.id);
      onNotify(`Pengeluaran "${deletingExpense.description}" telah dihapus.`);
      setDeletingExpense(null);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghapus pengeluaran.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const periodTitle =
    selectedMonth === 'ALL'
      ? `Tahun ${selectedYear}`
      : `${getMonthLabel(selectedMonth)} ${selectedYear}`;

  return (
    <div className="space-y-5">
      {/* Header & Period Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Catatan Pengeluaran Operasional
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pantau biaya bandwidth ISP, listrik, perangkat, maintenance, dan operasional.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengeluaran</span>
          </button>
        </div>

        {/* Category Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {EXPENSE_CATEGORIES.map((cat) => {
            const isSelected = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(isSelected ? 'ALL' : cat)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/50 border-blue-500'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {cat}
                </p>
                <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatRupiah(categoryTotals[cat])}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search & Date Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari keterangan pengeluaran atau catatan..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none py-2"
                aria-label="Filter Bulan Pengeluaran"
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
                aria-label="Filter Tahun Pengeluaran"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-slate-900">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 min-h-[44px]">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | ExpenseCategory)}
                className="bg-transparent text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none py-2"
                aria-label="Filter Kategori Pengeluaran"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900">
                  Semua Kategori
                </option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-white dark:bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Total Pengeluaran ({periodTitle}
            {categoryFilter !== 'ALL' ? ` · ${categoryFilter}` : ''}):
          </span>
          <span className="text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatRupiah(categoryFilter === 'ALL' && !search ? totalPeriodExpense : totalFilteredExpense)}
          </span>
        </div>
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <TrendingDown className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4">
            Belum Ada Catatan Pengeluaran
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Catat pengeluaran bulanan seperti langganan bandwidth utama, tagihan listrik server, atau pembelian perangkat.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran Pertama</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4">Keterangan</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-right">Jumlah</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateId(exp.expense_date)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {exp.description}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {exp.category}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {exp.notes || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {formatRupiah(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Pengeluaran"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(exp)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          title="Hapus Pengeluaran"
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

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredExpenses.map((exp) => (
              <div key={exp.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {exp.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {exp.category} ·{' '}
                      <span className="font-mono tabular-nums">{formatDateId(exp.expense_date)}</span>
                    </p>
                  </div>
                  <p className="font-mono tabular-nums font-bold text-sm text-rose-600 dark:text-rose-400 shrink-0">
                    {formatRupiah(exp.amount)}
                  </p>
                </div>

                {exp.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{exp.notes}</p>
                )}

                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(exp)}
                    className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingExpense(exp)}
                    className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingExpense ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Keterangan Pengeluaran <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Pembayaran Bandwidth Dedicated ISP"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jumlah (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500000"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tanggal Pengeluaran <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan Tambahan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsional (Mis. No Kwitansi / Toko Pembelian)"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Pengeluaran"
        message={`Apakah Anda yakin ingin menghapus pengeluaran "${deletingExpense?.description}" sebesar ${
          deletingExpense ? formatRupiah(deletingExpense.amount) : ''
        }?`}
      />
    </div>
  );
}

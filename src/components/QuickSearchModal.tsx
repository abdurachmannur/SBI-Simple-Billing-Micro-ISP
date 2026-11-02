import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  Users,
  Receipt,
  MessageCircle,
  Printer,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { AppSettings, Customer, NavTab, Payment } from '../types';
import {
  buildWhatsAppUrl,
  formatRupiah,
  getMonthLabel,
  normalizeWhatsAppPhone,
} from '../utils';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  payments: Payment[];
  settings: AppSettings;
  onNavigateToCustomer: (customer: Customer) => void;
  onNavigateToPayment: (payment: Payment) => void;
  onOpenInvoice: (payment: Payment) => void;
}

export function QuickSearchModal({
  isOpen,
  onClose,
  customers,
  payments,
  settings,
  onNavigateToCustomer,
  onNavigateToPayment,
  onOpenInvoice,
}: QuickSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const matchedCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return customers.slice(0, 5);
    }
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.package_name.toLowerCase().includes(q) ||
          (c.address && c.address.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [customers, query]);

  const matchedPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...payments].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return String(b.month).localeCompare(String(a.month));
    });

    if (!q) {
      return sorted.slice(0, 5);
    }

    return sorted
      .filter((p) => {
        const periodText = `${getMonthLabel(p.month)} ${p.year}`.toLowerCase();
        const statusText = p.status === 'lunas' ? 'lunas' : 'belum lunas';
        const custPhone = customerMap.get(p.customer_id)?.phone?.toLowerCase() || '';
        return (
          p.customer_name.toLowerCase().includes(q) ||
          periodText.includes(q) ||
          statusText.includes(q) ||
          custPhone.includes(q) ||
          String(p.amount).includes(q)
        );
      })
      .slice(0, 8);
  }, [payments, query, customerMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6 pt-4 sm:pt-14 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian Cepat Pelanggan dan Tagihan"
      >
        {/* Top Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama pelanggan, nomor WA, paket, atau bulan tagihan..."
            className="flex-1 min-h-[40px] text-sm sm:text-base bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Bersihkan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup pencarian cepat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-6 flex-1">
          {matchedCustomers.length === 0 && matchedPayments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Tidak Ditemukan Hasil untuk &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Coba gunakan kata kunci nama pelanggan, nomor telepon, atau bulan tagihan.
              </p>
            </div>
          ) : (
            <>
              {/* Section 1: Pelanggan */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {query.trim() ? 'Hasil Pelanggan' : 'Pelanggan Terbaru / Terdaftar'}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums">{matchedCustomers.length} data</span>
                </div>

                {matchedCustomers.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1">
                    Tidak ada pelanggan yang cocok dengan kata kunci.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {matchedCustomers.map((cust) => {
                      const cleanPhone = normalizeWhatsAppPhone(cust.phone);
                      const directWaUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : '';

                      return (
                        <div
                          key={cust.id}
                          className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cust.name}
                              </p>
                              <span
                                className={`text-[11px] font-semibold ${
                                  cust.status === 'active'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                · {cust.status === 'active' ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {cust.package_name} ({formatRupiah(cust.monthly_fee)}) · WA:{' '}
                              <span className="font-mono tabular-nums">{cust.phone}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {directWaUrl && (
                              <a
                                href={directWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Chat WA</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToCustomer(cust);
                                onClose();
                              }}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <span>Ke Pelanggan</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Tagihan & Pembayaran */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {query.trim() ? 'Hasil Tagihan & Pembayaran' : 'Tagihan Terbaru'}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums">{matchedPayments.length} data</span>
                </div>

                {matchedPayments.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1">
                    Tidak ada tagihan yang cocok dengan kata kunci.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {matchedPayments.map((pay) => {
                      const cust = customerMap.get(pay.customer_id);
                      const waBillUrl = buildWhatsAppUrl(pay, cust, settings);

                      return (
                        <div
                          key={pay.id}
                          className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {pay.customer_name}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                  pay.status === 'lunas'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {pay.status === 'lunas' ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Lunas</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    <span>Belum Lunas</span>
                                  </>
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Periode:{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {getMonthLabel(pay.month)} {pay.year}
                              </span>{' '}
                              · Nominal:{' '}
                              <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                                {formatRupiah(pay.amount)}
                              </span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <a
                              href={waBillUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                              title={
                                pay.status === 'lunas'
                                  ? 'Kirim Konfirmasi Lunas via WA'
                                  : 'Kirim Pengingat Tagihan via WA'
                              }
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WA</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenInvoice(pay);
                              }}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Invoice</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToPayment(pay);
                                onClose();
                              }}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <span>Buka Tagihan</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

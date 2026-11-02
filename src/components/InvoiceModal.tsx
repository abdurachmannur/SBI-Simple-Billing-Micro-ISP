import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, CheckCircle2, Clock, Percent, Building2, FileText, Receipt } from 'lucide-react';
import { AppSettings, Customer, Payment } from '../types';
import { formatDateId, formatRupiah, getMonthLabel } from '../utils';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  customer?: Customer;
  settings: AppSettings;
}

type PrintFormat = 'a4' | 'thermal80' | 'thermal58';

export function InvoiceModal({
  isOpen,
  onClose,
  payment,
  customer,
  settings,
}: InvoiceModalProps) {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [enablePpn, setEnablePpn] = useState(false);
  const [ppnPercent, setPpnPercent] = useState<number>(11);
  const [showPaymentInfo, setShowPaymentInfo] = useState<boolean>(true);
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Default: Aktif untuk Belum Lunas, Nonaktif untuk Lunas
  useEffect(() => {
    if (payment) {
      setShowPaymentInfo(payment.status !== 'lunas');
    }
  }, [payment, isOpen]);

  useEffect(() => {
    if (settings.logo_url && settings.logo_url.trim() !== '') {
      setLogoLoaded(false);
      setLogoError(false);
    } else {
      setLogoLoaded(true);
      setLogoError(false);
    }
  }, [settings.logo_url, isOpen]);

  if (!isOpen || !payment) return null;

  const baseAmount = Number(payment.amount) || 0;
  const validPpnRate = enablePpn ? Math.max(0, Math.min(100, Number(ppnPercent) || 0)) : 0;
  const ppnAmount = Math.round((baseAmount * validPpnRate) / 100);
  const grandTotal = baseAmount + ppnAmount;

  const invoiceNumber = `INV/${payment.year}${payment.month}/${payment.id
    .slice(-5)
    .toUpperCase()}`;
  const periodLabel = `${getMonthLabel(payment.month)} ${payment.year}`;
  const packageName = customer?.package_name || payment.notes || 'Layanan Internet WiFi';

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (settings.logo_url && !logoError && logoImgRef.current && !logoImgRef.current.complete) {
        await new Promise<void>((resolve) => {
          const img = logoImgRef.current;
          if (!img) {
            resolve();
            return;
          }
          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
          setTimeout(onDone, 1500);
        });
      }
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print flex flex-col gap-3 px-4 sm:px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Print Size Selector (A4 / Struk 80mm / Struk 58mm) */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  printFormat === 'a4'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4 Standar</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal80')}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  printFormat === 'thermal80'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Struk 80mm</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal58')}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  printFormat === 'thermal58'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Struk 58mm</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting || (Boolean(settings.logo_url) && !logoLoaded && !logoError)}
                className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {Boolean(settings.logo_url) && !logoLoaded && !logoError
                    ? 'Memuat Logo...'
                    : printFormat === 'a4'
                    ? 'Cetak Invoice A4'
                    : printFormat === 'thermal80'
                    ? 'Cetak Struk 80mm'
                    : 'Cetak Struk 58mm'}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                aria-label="Tutup invoice"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
              <input
                type="checkbox"
                checked={showPaymentInfo}
                onChange={(e) => setShowPaymentInfo(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                Tampilkan Info Rekening Pembayaran
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
              <input
                type="checkbox"
                checked={enablePpn}
                onChange={(e) => setEnablePpn(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                Terapkan PPN
              </span>
            </label>

            {enablePpn && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={ppnPercent}
                  onChange={(e) => setPpnPercent(Number(e.target.value))}
                  className="w-14 text-xs sm:text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                  aria-label="Persentase PPN"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
            )}
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 flex-1">
          {printFormat === 'a4' ? (
            <div
              id="printable-invoice-area"
              className="print-mode-a4 max-w-2xl mx-auto bg-white text-slate-900 rounded-xl border border-slate-200 p-6 sm:p-10 shadow-xs"
            >
              {/* Header Invoice A4 */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="flex items-start gap-4">
                  {settings.logo_url && !logoError ? (
                    <img
                      ref={logoImgRef}
                      src={settings.logo_url}
                      alt={settings.business_name || settings.app_name}
                      referrerPolicy="no-referrer"
                      onLoad={() => setLogoLoaded(true)}
                      onError={() => {
                        setLogoError(true);
                        setLogoLoaded(true);
                      }}
                      className="w-14 h-14 object-contain rounded-lg border border-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                      {settings.business_name || settings.app_name}
                    </h1>
                    {settings.business_address && (
                      <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
                        {settings.business_address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Invoice Tagihan WiFi
                  </p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Periode: <span className="font-semibold text-slate-900">{periodLabel}</span>
                  </p>
                </div>
              </div>

              {/* Customer & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Ditagihkan Kepada
                  </p>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {payment.customer_name}
                  </p>
                  {customer?.phone && (
                    <p className="text-xs font-mono tabular-nums text-slate-600 mt-0.5">
                      Telp/WA: {customer.phone}
                    </p>
                  )}
                  {customer?.address && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {customer.address}
                    </p>
                  )}
                </div>

                <div className="sm:text-right flex flex-col sm:items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Status Pembayaran
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold">
                      {payment.status === 'lunas' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">LUNAS</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-red-600" />
                          <span className="text-red-700">BELUM LUNAS</span>
                        </>
                      )}
                    </div>
                  </div>

                  {payment.status === 'lunas' && (
                    <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                      <p>
                        Tanggal Bayar:{' '}
                        <span className="font-mono tabular-nums font-medium text-slate-900">
                          {formatDateId(payment.payment_date)}
                        </span>
                      </p>
                      <p>
                        Metode Pembayaran:{' '}
                        <span className="font-medium text-slate-900">
                          {payment.method || 'Tunai'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 pr-4">Deskripsi Layanan</th>
                      <th className="py-2.5 px-4">Periode</th>
                      <th className="py-2.5 pl-4 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    <tr>
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-slate-900">{packageName}</p>
                        {payment.notes && payment.notes !== `Tagihan Paket ${packageName}` && (
                          <p className="text-xs text-slate-500 mt-0.5">{payment.notes}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap">
                        {periodLabel}
                      </td>
                      <td className="py-4 pl-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatRupiah(baseAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals Summary */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-end space-y-2">
                  <div className="w-full sm:w-64 flex items-center justify-between text-sm text-slate-600">
                    <span>Subtotal Tagihan</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {formatRupiah(baseAmount)}
                    </span>
                  </div>

                  {enablePpn && (
                    <div className="w-full sm:w-64 flex items-center justify-between text-sm text-slate-600">
                      <span>PPN ({validPpnRate}%)</span>
                      <span className="font-mono tabular-nums font-medium text-slate-900">
                        {formatRupiah(ppnAmount)}
                      </span>
                    </div>
                  )}

                  <div className="w-full sm:w-64 flex items-center justify-between pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
                    <span>Total Tagihan</span>
                    <span className="font-mono tabular-nums text-blue-700">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Payment Info */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs text-slate-600">
                {showPaymentInfo ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800">Informasi Rekening Pembayaran:</p>
                    {settings.bank_name || settings.bank_account ? (
                      <p>
                        Bank {settings.bank_name}:{' '}
                        <span className="font-mono tabular-nums font-medium text-slate-900">
                          {settings.bank_account}
                        </span>
                      </p>
                    ) : null}
                    {settings.ewallet_name || settings.ewallet_account ? (
                      <p>
                        {settings.ewallet_name}:{' '}
                        <span className="font-mono tabular-nums font-medium text-slate-900">
                          {settings.ewallet_account}
                        </span>
                      </p>
                    ) : null}
                    {!settings.bank_name &&
                    !settings.bank_account &&
                    !settings.ewallet_name &&
                    !settings.ewallet_account ? (
                      <p className="text-slate-400">
                        Rekening pembayaran belum diatur pada menu Pengaturan.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div />
                )}

                <div className="sm:text-right text-slate-500">
                  <p>Terima kasih atas kepercayaan Anda.</p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {settings.business_name || settings.app_name}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Thermal Receipt Layout (58mm / 80mm) */
            <div
              id="printable-invoice-area"
              className={`${
                printFormat === 'thermal80'
                  ? 'print-mode-thermal80 max-w-[300px]'
                  : 'print-mode-thermal58 max-w-[215px]'
              } mx-auto bg-white text-slate-900 rounded-lg border border-slate-300 p-4 shadow-xs font-mono text-[11px] leading-snug`}
            >
              {/* Store Header */}
              <div className="text-center pb-2.5 border-b border-dashed border-slate-400">
                {settings.logo_url && !logoError && (
                  <img
                    ref={logoImgRef}
                    src={settings.logo_url}
                    alt={settings.business_name || settings.app_name}
                    referrerPolicy="no-referrer"
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => {
                      setLogoError(true);
                      setLogoLoaded(true);
                    }}
                    className="w-10 h-10 object-contain mx-auto mb-1.5"
                  />
                )}
                <p className="font-bold text-xs uppercase text-slate-900">
                  {settings.business_name || settings.app_name}
                </p>
                {settings.business_address && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{settings.business_address}</p>
                )}
              </div>

              {/* Meta Details */}
              <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">No:</span>
                  <span className="font-bold text-right">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Pelanggan:</span>
                  <span className="font-bold text-right">{payment.customer_name}</span>
                </div>
                {customer?.phone && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">WA:</span>
                    <span className="text-right">{customer.phone}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Periode:</span>
                  <span className="font-bold text-right">{periodLabel}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-right">
                    {payment.status === 'lunas' ? 'LUNAS' : 'BELUM LUNAS'}
                  </span>
                </div>
                {payment.status === 'lunas' && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Tgl Bayar:</span>
                      <span className="text-right">{formatDateId(payment.payment_date)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Metode:</span>
                      <span className="text-right">{payment.method || 'Tunai'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Item & Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5">
                <div>
                  <p className="font-bold text-slate-900">{packageName}</p>
                  <div className="flex justify-between mt-0.5">
                    <span>1x Tagihan Bulanan</span>
                    <span className="font-bold">{formatRupiah(baseAmount)}</span>
                  </div>
                </div>

                {enablePpn && (
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-300">
                    <span>PPN ({validPpnRate}%)</span>
                    <span>{formatRupiah(ppnAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-400 text-xs font-bold">
                  <span>TOTAL</span>
                  <span>{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              {/* Payment Account Info */}
              {showPaymentInfo && (
                <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                  <p className="font-bold">Rekening Pembayaran:</p>
                  {(settings.bank_name || settings.bank_account) && (
                    <p>
                      {settings.bank_name}: {settings.bank_account}
                    </p>
                  )}
                  {(settings.ewallet_name || settings.ewallet_account) && (
                    <p>
                      {settings.ewallet_name}: {settings.ewallet_account}
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="pt-2.5 text-center text-[10px] text-slate-600 space-y-0.5">
                <p>Terima kasih atas pembayaran Anda</p>
                <p className="font-bold text-slate-800">
                  {settings.business_name || settings.app_name}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import * as XLSX from 'xlsx';
import {
  AppSettings,
  Customer,
  Expense,
  INDONESIAN_MONTHS,
  Payment,
  PaymentMethod,
  PaymentStatus,
  WifiPackage,
} from './types';

export function formatRupiah(amount: number): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatBytes(bytes: number): string {
  const val = Number(bytes) || 0;
  if (val <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(val) / Math.log(1024)), units.length - 1);
  const formatted = val / Math.pow(1024, idx);
  return `${formatted >= 100 ? formatted.toFixed(0) : formatted.toFixed(1)} ${units[idx]}`;
}

export function formatBps(bps: number): string {
  const val = Number(bps) || 0;
  if (val <= 0) return '0 bps';
  if (val < 1000) return `${Math.round(val)} bps`;
  if (val < 1_000_000) return `${(val / 1000).toFixed(1)} Kbps`;
  if (val < 1_000_000_000) return `${(val / 1_000_000).toFixed(2)} Mbps`;
  return `${(val / 1_000_000_000).toFixed(2)} Gbps`;
}

export function isPaymentOverdue(payment: Payment, customer?: Customer): boolean {
  if (payment.status === 'lunas') return false;
  const dueDay = Math.min(28, Math.max(1, Number(customer?.due_day) || 10));
  const billYear = Number(payment.year);
  const billMonthIndex = Number(payment.month) - 1; // 0..11
  if (isNaN(billYear) || isNaN(billMonthIndex)) return false;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueMidnight = new Date(billYear, billMonthIndex, dueDay).getTime();
  return todayMidnight > dueMidnight;
}

export function getMonthLabel(monthStr: string): string {
  const normalized = String(monthStr).padStart(2, '0');
  const found = INDONESIAN_MONTHS.find((m) => m.value === normalized);
  return found ? found.label : monthStr;
}

export function getMonthShortLabel(monthStr: string): string {
  const normalized = String(monthStr).padStart(2, '0');
  const found = INDONESIAN_MONTHS.find((m) => m.value === normalized);
  return found ? found.short : monthStr;
}

export function formatDateId(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    if (!y || !m || !d) return dateStr;
    return `${d} ${getMonthShortLabel(m)} ${y}`;
  } catch {
    return dateStr;
  }
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  return digits;
}

export function buildWhatsAppUrl(
  payment: Payment,
  customer: Customer | undefined,
  settings: AppSettings
): string {
  const rawPhone = customer?.phone || '';
  const phone = normalizeWhatsAppPhone(rawPhone);
  const template =
    payment.status === 'lunas'
      ? settings.wa_template_paid
      : settings.wa_template_unpaid;

  const periodText = `${getMonthLabel(payment.month)} ${payment.year}`;
  const packageName = customer?.package_name || 'Internet WiFi';
  const businessName = settings.business_name || settings.app_name || 'Layanan WiFi Kami';

  const message = template
    .replace(/\{nama\}/gi, payment.customer_name)
    .replace(/\{periode\}/gi, periodText)
    .replace(/\{jumlah\}/gi, formatRupiah(payment.amount))
    .replace(/\{paket\}/gi, packageName)
    .replace(/\{bisnis\}/gi, businessName)
    .replace(/\{bank\}/gi, settings.bank_name || '-')
    .replace(/\{rekening\}/gi, settings.bank_account || '-')
    .replace(/\{ewallet\}/gi, settings.ewallet_name || 'E-Wallet')
    .replace(/\{no_ewallet\}/gi, settings.ewallet_account || '-')
    .replace(/\{metode\}/gi, payment.method || 'Tunai/Transfer')
    .replace(/\{tanggal_bayar\}/gi, payment.payment_date ? formatDateId(payment.payment_date) : '-');

  const encoded = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function downloadCustomerImportTemplateXlsx() {
  const sampleRows = [
    {
      'Nama Pelanggan': 'Budi Santoso',
      'Nomor WhatsApp': '081234567891',
      Alamat: 'Jl. Melati No. 12 RT 02/01',
      'Paket WiFi': 'Paket Keluarga 20 Mbps',
      'Tarif Bulanan': 200000,
      'Tanggal Bergabung': new Date().toISOString().slice(0, 10),
      'Tanggal Jatuh Tempo': 10,
      'Username PPPoE / IP': 'budi-santoso',
      'Info ODP / Perangkat': 'ODP-01 Port 3 / ZTE F609',
      'Link Google Maps': 'https://maps.google.com/?q=-6.200000,106.816666',
      Status: 'active',
      Catatan: 'Pemasangan router lantai 1',
    },
    {
      'Nama Pelanggan': 'Siti Aminah',
      'Nomor WhatsApp': '085712345678',
      Alamat: 'Gg. Kenanga No. 5 RT 04/02',
      'Paket WiFi': 'Paket Hemat 10 Mbps',
      'Tarif Bulanan': 150000,
      'Tanggal Bergabung': new Date().toISOString().slice(0, 10),
      'Tanggal Jatuh Tempo': 15,
      'Username PPPoE / IP': 'siti-aminah',
      'Info ODP / Perangkat': 'ODP-02 Port 5 / Huawei HG8245H',
      'Link Google Maps': '',
      Status: 'active',
      Catatan: 'Tagihan setiap pertengahan bulan',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 26 },
    { wch: 32 },
    { wch: 12 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Pelanggan');
  XLSX.writeFile(workbook, 'Template_Impor_Pelanggan.xlsx');
}

export function exportCustomersToXlsx(customers: Customer[]) {
  const rows = customers.map((c, idx) => ({
    No: idx + 1,
    'Nama Pelanggan': c.name,
    'Nomor WhatsApp': c.phone,
    Alamat: c.address || '-',
    'Paket WiFi': c.package_name,
    'Tarif Bulanan': c.monthly_fee,
    'Tanggal Bergabung': c.join_date,
    'Tanggal Jatuh Tempo': c.due_day || 10,
    'Username PPPoE / IP': c.pppoe_user || '',
    'Info ODP / Perangkat': c.odp_info || '',
    'Link Google Maps': c.maps_url || '',
    Status: c.status === 'active' ? 'Aktif' : 'Nonaktif',
    Catatan: c.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 26 },
    { wch: 32 },
    { wch: 14 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Pelanggan');
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Data_Pelanggan_WiFi_${dateTag}.xlsx`);
}

export async function parseCustomerImportFile(file: File): Promise<Partial<Customer>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  return rawRows.map((row) => {
    const getVal = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const cleanK = k.trim().toLowerCase();
        if (keys.includes(cleanK)) {
          return row[k];
        }
      }
      return '';
    };

    const name = String(getVal(['nama pelanggan', 'nama', 'name'])).trim();
    const phone = String(
      getVal(['nomor whatsapp', 'no whatsapp', 'whatsapp', 'telepon', 'no hp', 'phone'])
    ).trim();
    const address = String(getVal(['alamat', 'address'])).trim();
    const package_name = String(
      getVal(['paket wifi', 'paket', 'package_name', 'package'])
    ).trim();
    const feeRaw = getVal(['tarif bulanan', 'tarif bulanan (rp)', 'tarif', 'harga', 'monthly_fee', 'fee']);
    const cleanFee =
      typeof feeRaw === 'number'
        ? feeRaw
        : Number(String(feeRaw).replace(/[^0-9.-]/g, ''));

    const join_date = String(
      getVal(['tanggal bergabung', 'tgl bergabung', 'join_date', 'tanggal']) ||
        new Date().toISOString().slice(0, 10)
    ).trim();

    const dueRaw = getVal(['tanggal jatuh tempo', 'tgl jatuh tempo', 'jatuh tempo', 'due_day']);
    const dueNum = Number(String(dueRaw).replace(/[^0-9]/g, ''));
    const due_day = dueNum >= 1 && dueNum <= 28 ? dueNum : 10;

    const pppoe_user = String(
      getVal(['username pppoe / ip', 'username pppoe', 'pppoe', 'ip', 'pppoe_user'])
    ).trim();
    const odp_info = String(
      getVal(['info odp / perangkat', 'info odp', 'odp', 'perangkat', 'odp_info'])
    ).trim();
    const maps_url = String(
      getVal(['link google maps', 'google maps', 'maps', 'maps_url'])
    ).trim();

    const statusText = String(getVal(['status']) || 'active')
      .trim()
      .toLowerCase();
    const status: 'active' | 'inactive' =
      statusText === 'inactive' || statusText === 'nonaktif' || statusText === 'tidak aktif'
        ? 'inactive'
        : 'active';

    const notes = String(getVal(['catatan', 'keterangan', 'notes'])).trim();

    return {
      name,
      phone,
      address,
      package_name,
      monthly_fee: cleanFee,
      join_date,
      due_day,
      pppoe_user,
      odp_info,
      maps_url,
      status,
      notes,
    };
  });
}

export function exportPaymentsToXlsx(payments: Payment[], periodLabel: string) {
  const rows = payments.map((p, idx) => ({
    No: idx + 1,
    'Nama Pelanggan': p.customer_name,
    Periode: `${getMonthLabel(p.month)} ${p.year}`,
    'Jumlah Tagihan (Rp)': p.amount,
    Status: p.status === 'lunas' ? 'Lunas' : 'Belum Lunas',
    'Tanggal Pembayaran': p.payment_date || '-',
    'Metode Pembayaran': p.method || '-',
    Catatan: p.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tagihan_Pembayaran');
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `Tagihan_WiFi_${safePeriod}.xlsx`);
}

export function exportFullBackupToXlsx(
  customers: Customer[],
  payments: Payment[],
  expenses: Expense[],
  packages: WifiPackage[],
  settings: AppSettings
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Pelanggan
  const customerRows =
    customers.length > 0
      ? customers.map((c, idx) => ({
          No: idx + 1,
          'ID Pelanggan': c.id,
          'Nama Pelanggan': c.name,
          'Nomor WhatsApp': c.phone,
          Alamat: c.address || '-',
          'Paket WiFi': c.package_name,
          'Tarif Bulanan (Rp)': c.monthly_fee,
          'Tanggal Bergabung': c.join_date,
          'Tanggal Jatuh Tempo': c.due_day || 10,
          'Username PPPoE / IP': c.pppoe_user || '',
          'Info ODP / Perangkat': c.odp_info || '',
          'Link Google Maps': c.maps_url || '',
          Status: c.status === 'active' ? 'Aktif' : 'Nonaktif',
          Catatan: c.notes || '',
        }))
      : [
          {
            No: '',
            'ID Pelanggan': '',
            'Nama Pelanggan': 'Belum ada data pelanggan',
            'Nomor WhatsApp': '',
            Alamat: '',
            'Paket WiFi': '',
            'Tarif Bulanan (Rp)': '',
            'Tanggal Bergabung': '',
            'Tanggal Jatuh Tempo': '',
            'Username PPPoE / IP': '',
            'Info ODP / Perangkat': '',
            'Link Google Maps': '',
            Status: '',
            Catatan: '',
          },
        ];

  const wsCustomers = XLSX.utils.json_to_sheet(customerRows);
  wsCustomers['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCustomers, 'Pelanggan');

  // Sheet 2: Tagihan & Pembayaran
  const paymentRows =
    payments.length > 0
      ? payments.map((p, idx) => ({
          No: idx + 1,
          'ID Pelanggan': p.customer_id,
          'Nama Pelanggan': p.customer_name,
          Bulan: getMonthLabel(p.month),
          'Kode Bulan': p.month,
          Tahun: p.year,
          'Jumlah Tagihan (Rp)': p.amount,
          Status: p.status === 'lunas' ? 'Lunas' : 'Belum Lunas',
          'Tanggal Pembayaran': p.payment_date || '-',
          'Metode Pembayaran': p.method || '-',
          Catatan: p.notes || '',
        }))
      : [
          {
            No: '',
            'ID Pelanggan': '',
            'Nama Pelanggan': 'Belum ada data tagihan',
            Bulan: '',
            'Kode Bulan': '',
            Tahun: '',
            'Jumlah Tagihan (Rp)': '',
            Status: '',
            'Tanggal Pembayaran': '',
            'Metode Pembayaran': '',
            Catatan: '',
          },
        ];

  const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
  wsPayments['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsPayments, 'Tagihan_Pembayaran');

  // Sheet 3: Pengeluaran
  const expenseRows =
    expenses.length > 0
      ? expenses.map((e, idx) => ({
          No: idx + 1,
          Tanggal: e.expense_date,
          Keterangan: e.description,
          Kategori: e.category,
          'Jumlah Pengeluaran (Rp)': e.amount,
          Catatan: e.notes || '',
        }))
      : [
          {
            No: '',
            Tanggal: '',
            Keterangan: 'Belum ada data pengeluaran',
            Kategori: '',
            'Jumlah Pengeluaran (Rp)': '',
            Catatan: '',
          },
        ];

  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
  wsExpenses['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 22 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsExpenses, 'Pengeluaran');

  // Sheet 4: Paket WiFi
  const packageRows =
    packages.length > 0
      ? packages.map((pkg, idx) => ({
          No: idx + 1,
          'Nama Paket': pkg.name,
          Kecepatan: pkg.speed,
          'Harga Bulanan (Rp)': pkg.price,
          Status: pkg.is_active ? 'Aktif' : 'Nonaktif',
          Deskripsi: pkg.description || '',
        }))
      : [
          {
            No: '',
            'Nama Paket': 'Belum ada paket WiFi',
            Kecepatan: '',
            'Harga Bulanan (Rp)': '',
            Status: '',
            Deskripsi: '',
          },
        ];

  const wsPackages = XLSX.utils.json_to_sheet(packageRows);
  wsPackages['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsPackages, 'Paket_WiFi');

  const dateTag = new Date().toISOString().slice(0, 10);
  const safeBiz = (settings.business_name || settings.app_name || 'Simple_Billing_ISP')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30);
  XLSX.writeFile(workbook, `Backup_${safeBiz}_${dateTag}.xlsx`);
}

export async function parseFullBackupXlsx(file: File): Promise<{
  customers: Partial<Customer>[];
  payments: Partial<Payment>[];
  expenses: Partial<Expense>[];
  wifi_packages: Partial<WifiPackage>[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const getVal = (row: Record<string, any>, keys: string[]) => {
    for (const k of Object.keys(row)) {
      const cleanK = k.trim().toLowerCase();
      if (keys.includes(cleanK)) {
        return row[k];
      }
    }
    return '';
  };

  const toNumber = (raw: any) =>
    typeof raw === 'number' ? raw : Number(String(raw || '').replace(/[^0-9.-]/g, '')) || 0;

  // 1. Parse Pelanggan
  const customerSheetName =
    workbook.SheetNames.find((s) => s.toLowerCase().includes('pelanggan')) || workbook.SheetNames[0];
  const customers: Partial<Customer>[] = [];
  if (customerSheetName && workbook.Sheets[customerSheetName]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[customerSheetName], {
      defval: '',
    });
    for (const r of rows) {
      const name = String(getVal(r, ['nama pelanggan', 'nama', 'name'])).trim();
      if (!name || name.toLowerCase() === 'belum ada data pelanggan') continue;
      const id = String(getVal(r, ['id pelanggan', 'id'])).trim() || undefined;
      const phone = String(getVal(r, ['nomor whatsapp', 'no whatsapp', 'whatsapp', 'phone'])).trim();
      const address = String(getVal(r, ['alamat', 'address'])).trim();
      const package_name = String(getVal(r, ['paket wifi', 'paket', 'package_name'])).trim();
      const monthly_fee = toNumber(getVal(r, ['tarif bulanan (rp)', 'tarif bulanan', 'tarif', 'monthly_fee']));
      const join_date =
        String(getVal(r, ['tanggal bergabung', 'join_date'])).trim() ||
        new Date().toISOString().slice(0, 10);
      const dueRaw = toNumber(getVal(r, ['tanggal jatuh tempo', 'jatuh tempo', 'due_day']));
      const due_day = dueRaw >= 1 && dueRaw <= 28 ? dueRaw : 10;
      const pppoe_user = String(getVal(r, ['username pppoe / ip', 'username pppoe', 'pppoe_user'])).trim();
      const odp_info = String(getVal(r, ['info odp / perangkat', 'info odp', 'odp_info'])).trim();
      const maps_url = String(getVal(r, ['link google maps', 'maps_url'])).trim();
      const statusStr = String(getVal(r, ['status'])).trim().toLowerCase();
      const status: 'active' | 'inactive' =
        statusStr === 'nonaktif' || statusStr === 'inactive' ? 'inactive' : 'active';
      const notes = String(getVal(r, ['catatan', 'notes'])).trim();

      customers.push({
        id,
        name,
        phone,
        address: address === '-' ? '' : address,
        package_name,
        monthly_fee,
        join_date,
        due_day,
        pppoe_user,
        odp_info,
        maps_url,
        status,
        notes,
      });
    }
  }

  // 2. Parse Tagihan_Pembayaran
  const paymentSheetName = workbook.SheetNames.find(
    (s) => s.toLowerCase().includes('tagihan') || s.toLowerCase().includes('pembayaran')
  );
  const payments: Partial<Payment>[] = [];
  if (paymentSheetName && workbook.Sheets[paymentSheetName]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[paymentSheetName], {
      defval: '',
    });
    for (const r of rows) {
      const customer_name = String(getVal(r, ['nama pelanggan', 'customer_name'])).trim();
      if (!customer_name || customer_name.toLowerCase() === 'belum ada data tagihan') continue;

      const customer_id = String(getVal(r, ['id pelanggan', 'customer_id'])).trim();
      const monthRaw = String(getVal(r, ['kode bulan', 'bulan', 'month'])).trim();
      let month = '01';
      const foundMonth = INDONESIAN_MONTHS.find(
        (m) =>
          m.label.toLowerCase() === monthRaw.toLowerCase() ||
          m.short.toLowerCase() === monthRaw.toLowerCase() ||
          m.value === monthRaw.padStart(2, '0')
      );
      if (foundMonth) {
        month = foundMonth.value;
      } else if (/^\d{1,2}$/.test(monthRaw)) {
        month = monthRaw.padStart(2, '0');
      }

      const year = toNumber(getVal(r, ['tahun', 'year'])) || new Date().getFullYear();
      const amount = toNumber(getVal(r, ['jumlah tagihan (rp)', 'jumlah tagihan', 'amount']));
      const statusText = String(getVal(r, ['status'])).trim().toLowerCase();
      const status: PaymentStatus = statusText === 'lunas' ? 'lunas' : 'belum_lunas';
      const payDateRaw = String(getVal(r, ['tanggal pembayaran', 'payment_date'])).trim();
      const payment_date = payDateRaw === '-' ? '' : payDateRaw;
      const methodRaw = String(getVal(r, ['metode pembayaran', 'method'])).trim();
      const method = (methodRaw === '-' ? '' : methodRaw) as PaymentMethod;
      const notes = String(getVal(r, ['catatan', 'notes'])).trim();

      payments.push({
        customer_id,
        customer_name,
        month,
        year,
        amount,
        status,
        payment_date,
        method,
        notes,
      });
    }
  }

  // 3. Parse Pengeluaran
  const expenseSheetName = workbook.SheetNames.find((s) =>
    s.toLowerCase().includes('pengeluaran')
  );
  const expenses: Partial<Expense>[] = [];
  if (expenseSheetName && workbook.Sheets[expenseSheetName]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[expenseSheetName], {
      defval: '',
    });
    for (const r of rows) {
      const description = String(getVal(r, ['keterangan', 'deskripsi', 'description'])).trim();
      if (!description || description.toLowerCase() === 'belum ada data pengeluaran') continue;
      const expense_date =
        String(getVal(r, ['tanggal', 'expense_date'])).trim() ||
        new Date().toISOString().slice(0, 10);
      const category = (String(getVal(r, ['kategori', 'category'])).trim() || 'Lainnya') as any;
      const amount = toNumber(getVal(r, ['jumlah pengeluaran (rp)', 'jumlah', 'amount']));
      const notes = String(getVal(r, ['catatan', 'notes'])).trim();

      expenses.push({
        expense_date,
        description,
        category,
        amount,
        notes,
      });
    }
  }

  // 4. Parse Paket_WiFi
  const pkgSheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('paket'));
  const wifi_packages: Partial<WifiPackage>[] = [];
  if (pkgSheetName && workbook.Sheets[pkgSheetName]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[pkgSheetName], {
      defval: '',
    });
    for (const r of rows) {
      const name = String(getVal(r, ['nama paket', 'name'])).trim();
      if (!name || name.toLowerCase() === 'belum ada paket wifi') continue;
      const speed = String(getVal(r, ['kecepatan', 'speed'])).trim() || '10 Mbps';
      const price = toNumber(getVal(r, ['harga bulanan (rp)', 'harga', 'price']));
      const statusStr = String(getVal(r, ['status'])).trim().toLowerCase();
      const is_active = statusStr !== 'nonaktif' && statusStr !== 'inactive';
      const description = String(getVal(r, ['deskripsi', 'description'])).trim();

      wifi_packages.push({
        name,
        speed,
        price,
        is_active,
        description,
      });
    }
  }

  return { customers, payments, expenses, wifi_packages };
}

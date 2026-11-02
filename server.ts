import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  executeMikrotikControlAction,
  fetchMikrotikSnapshot,
  MikrotikConnectionConfig,
  parseRouterOsUptimeToSeconds,
  testMikrotikConnection,
} from './server/mikrotikClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  address: string;
  package_name: string;
  monthly_fee: number;
  join_date: string;
  status: 'active' | 'inactive';
  notes: string;
  due_day?: number;
  pppoe_user?: string;
  odp_info?: string;
  maps_url?: string;
  createdAt: string;
}

interface Payment {
  id: string;
  ownerId: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  month: string;
  year: number;
  payment_date: string;
  method: 'Cash' | 'DANA' | 'BRI' | 'Mandiri' | 'Gateway' | 'Rekening Lain' | '';
  status: 'lunas' | 'belum_lunas';
  notes: string;
  createdAt: string;
}

interface Expense {
  id: string;
  ownerId: string;
  description: string;
  amount: number;
  category: 'Operasional' | 'Maintenance' | 'Perangkat' | 'Internet/ISP' | 'Listrik' | 'Lainnya';
  expense_date: string;
  notes: string;
  createdAt: string;
}

interface WifiPackage {
  id: string;
  ownerId: string;
  name: string;
  speed: string;
  price: number;
  description: string;
  is_active: boolean;
  createdAt: string;
}

interface AppSettings {
  ownerId: string;
  app_name: string;
  business_name: string;
  business_phone: string;
  business_address: string;
  logo_url: string;
  bank_name: string;
  bank_account: string;
  ewallet_name: string;
  ewallet_account: string;
  wa_template_unpaid: string;
  wa_template_paid: string;
  mikrotik_host?: string;
  mikrotik_port?: number;
  mikrotik_user?: string;
  mikrotik_password?: string;
  mikrotik_protocol?: 'api' | 'api-ssl' | 'rest-http' | 'rest-https';
}

interface DatabaseSchema {
  customers: Customer[];
  payments: Payment[];
  expenses: Expense[];
  wifi_packages: WifiPackage[];
  app_settings: Record<string, AppSettings>;
}

const DEFAULT_UNPAID_TEMPLATE = `Halo Bapak/Ibu *{nama}*,

Kami dari *{bisnis}* ingin mengingatkan tagihan layanan internet WiFi Anda untuk periode *{periode}*:

• Paket: {paket}
• Total Tagihan: *{jumlah}*
• Status: *BELUM LUNAS*

Pembayaran dapat dilakukan melalui:
• Bank {bank}: {rekening}
• {ewallet}: {no_ewallet}
• Atau tunai kepada petugas kami.

Mohon abaikan pesan ini apabila sudah melakukan pembayaran. Terima kasih atas kepercayaan Anda.`;

const DEFAULT_PAID_TEMPLATE = `Halo Bapak/Ibu *{nama}*,

Terima kasih! Pembayaran tagihan internet WiFi *{bisnis}* Anda telah kami terima dengan rincian:

• Periode: *{periode}*
• Paket: {paket}
• Jumlah Dibayar: *{jumlah}*
• Metode: {metode}
• Tanggal Bayar: {tanggal_bayar}
• Status: *LUNAS*

Selamat menikmati layanan internet kami. Terima kasih!`;

function createDefaultPackages(ownerId: string): WifiPackage[] {
  const now = new Date().toISOString();
  return [
    {
      id: `pkg_${ownerId}_1`,
      ownerId,
      name: 'Paket Hemat 10 Mbps',
      speed: '10 Mbps',
      price: 150000,
      description: 'Ideal untuk 2-4 perangkat HP & browsing harian',
      is_active: true,
      createdAt: now,
    },
    {
      id: `pkg_${ownerId}_2`,
      ownerId,
      name: 'Paket Keluarga 20 Mbps',
      speed: '20 Mbps',
      price: 200000,
      description: 'Cocok untuk streaming HD, belajar online & keluarga',
      is_active: true,
      createdAt: now,
    },
    {
      id: `pkg_${ownerId}_3`,
      ownerId,
      name: 'Paket Cepat 35 Mbps',
      speed: '35 Mbps',
      price: 275000,
      description: 'Stabil untuk WFH, gaming & banyak perangkat sekaligus',
      is_active: true,
      createdAt: now,
    },
    {
      id: `pkg_${ownerId}_4`,
      ownerId,
      name: 'Paket Bisnis 50 Mbps',
      speed: '50 Mbps',
      price: 350000,
      description: 'Prioritas bandwidth untuk usaha, toko, atau kantor kecil',
      is_active: true,
      createdAt: now,
    },
  ];
}

function createDefaultSettings(ownerId: string): AppSettings {
  return {
    ownerId,
    app_name: 'Simple Billing Mini ISP',
    business_name: 'Nusantara Net WiFi',
    business_phone: '081234567890',
    business_address: 'Jl. Merdeka Raya No. 45, RT 04 / RW 02',
    logo_url: '',
    bank_name: 'BRI',
    bank_account: '1234-01-005678-53-1 a/n Nusantara Net',
    ewallet_name: 'DANA',
    ewallet_account: '081234567890 a/n Nusantara Net',
    wa_template_unpaid: DEFAULT_UNPAID_TEMPLATE,
    wa_template_paid: DEFAULT_PAID_TEMPLATE,
    mikrotik_host: '',
    mikrotik_port: 8728,
    mikrotik_user: 'admin',
    mikrotik_password: '',
    mikrotik_protocol: 'api',
  };
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = {
      customers: [],
      payments: [],
      expenses: [],
      wifi_packages: [],
      app_settings: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    return {
      customers: [],
      payments: [],
      expenses: [],
      wifi_packages: [],
      app_settings: {},
    };
  }
}

function saveDb(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function ensureOwnerInitialized(db: DatabaseSchema, ownerId: string) {
  let modified = false;
  if (!db.app_settings[ownerId]) {
    db.app_settings[ownerId] = createDefaultSettings(ownerId);
    modified = true;
  }
  const hasPackages = db.wifi_packages.some((p) => p.ownerId === ownerId);
  if (!hasPackages) {
    const defaultPkgs = createDefaultPackages(ownerId);
    db.wifi_packages.push(...defaultPkgs);
    modified = true;
  }
  if (modified) {
    saveDb(db);
  }
}

function getOwnerId(req: express.Request): string | null {
  const headerOwner = req.headers['x-owner-id'];
  if (typeof headerOwner === 'string' && headerOwner.trim().length > 0) {
    return headerOwner.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return null;
}

function parseMikrotikPairValue(pairStr: string | undefined): [number, number] {
  if (!pairStr) return [0, 0];
  const parts = String(pairStr).split('/');
  const first = Number(parts[0]) || 0;
  const second = Number(parts[1]) || 0;
  return [first, second];
}

function normalizeQueueTargetIp(targetStr: string | undefined): string {
  if (!targetStr) return '';
  const firstTarget = String(targetStr).split(',')[0].trim();
  return firstTarget.replace(/\/\d+$/, '');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  const requireOwner: express.RequestHandler = (req, res, next) => {
    const ownerId = getOwnerId(req);
    if (!ownerId) {
      res.status(401).json({ error: 'Tidak terautentikasi. Silakan masuk terlebih dahulu.' });
      return;
    }
    (req as any).ownerId = ownerId;
    next();
  };

  // Bootstrap all owner data
  app.get('/api/bootstrap', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const db = loadDb();
    ensureOwnerInitialized(db, ownerId);

    res.json({
      settings: db.app_settings[ownerId],
      wifi_packages: db.wifi_packages.filter((p) => p.ownerId === ownerId),
      customers: db.customers.filter((c) => c.ownerId === ownerId),
      payments: db.payments.filter((p) => p.ownerId === ownerId),
      expenses: db.expenses.filter((e) => e.ownerId === ownerId),
    });
  });

  // Upload Logo
  app.post('/api/upload-logo', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Format file gambar tidak valid.' });
      return;
    }
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'Data gambar tidak dapat diproses.' });
      return;
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].replace(/[^a-z0-9]/gi, '');
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Ukuran logo maksimal 2MB.' });
      return;
    }
    const filename = `logo_${ownerId}_${Date.now()}.${ext || 'png'}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    const logoUrl = `/uploads/${filename}`;
    res.json({ logo_url: logoUrl });
  });

  // Update Settings (including MikroTik settings)
  app.put('/api/settings', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const body = req.body;
    if (!body.app_name || typeof body.app_name !== 'string' || !body.app_name.trim()) {
      res.status(400).json({ error: 'Nama aplikasi wajib diisi.' });
      return;
    }
    const db = loadDb();
    ensureOwnerInitialized(db, ownerId);
    const prev = db.app_settings[ownerId];
    const updated: AppSettings = {
      ownerId,
      app_name: String(body.app_name).trim(),
      business_name: String(body.business_name ?? prev.business_name ?? '').trim(),
      business_phone: String(body.business_phone ?? prev.business_phone ?? '').trim(),
      business_address: String(body.business_address ?? prev.business_address ?? '').trim(),
      logo_url: String(body.logo_url ?? prev.logo_url ?? '').trim(),
      bank_name: String(body.bank_name ?? prev.bank_name ?? '').trim(),
      bank_account: String(body.bank_account ?? prev.bank_account ?? '').trim(),
      ewallet_name: String(body.ewallet_name ?? prev.ewallet_name ?? '').trim(),
      ewallet_account: String(body.ewallet_account ?? prev.ewallet_account ?? '').trim(),
      wa_template_unpaid: String(body.wa_template_unpaid ?? prev.wa_template_unpaid ?? DEFAULT_UNPAID_TEMPLATE),
      wa_template_paid: String(body.wa_template_paid ?? prev.wa_template_paid ?? DEFAULT_PAID_TEMPLATE),
      mikrotik_host: String(body.mikrotik_host ?? prev.mikrotik_host ?? '').trim(),
      mikrotik_port: Number(body.mikrotik_port ?? prev.mikrotik_port ?? 8728) || 8728,
      mikrotik_user: String(body.mikrotik_user ?? prev.mikrotik_user ?? 'admin').trim(),
      mikrotik_password:
        body.mikrotik_password !== undefined
          ? String(body.mikrotik_password)
          : (prev.mikrotik_password ?? ''),
      mikrotik_protocol: body.mikrotik_protocol || prev.mikrotik_protocol || 'api',
    };
    db.app_settings[ownerId] = updated;
    saveDb(db);
    res.json(updated);
  });

  // Restore Full Data Backup (.XLSX)
  app.post('/api/restore', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { mode, customers, payments, expenses, packages } = req.body;
    const db = loadDb();
    ensureOwnerInitialized(db, ownerId);

    const isReplace = mode === 'replace';
    if (isReplace) {
      db.customers = db.customers.filter((c) => c.ownerId !== ownerId);
      db.payments = db.payments.filter((p) => p.ownerId !== ownerId);
      db.expenses = db.expenses.filter((e) => e.ownerId !== ownerId);
      db.wifi_packages = db.wifi_packages.filter((p) => p.ownerId !== ownerId);
    }

    const now = new Date().toISOString();
    let restoredCustomers = 0;
    let restoredPayments = 0;
    let restoredExpenses = 0;
    let restoredPackages = 0;

    // 1. Restore Packages
    if (Array.isArray(packages)) {
      const existingPkgNames = new Set(
        db.wifi_packages.filter((p) => p.ownerId === ownerId).map((p) => p.name.toLowerCase())
      );
      packages.forEach((raw: any, i: number) => {
        const name = String(raw?.name ?? '').trim();
        if (!name) return;
        if (!isReplace && existingPkgNames.has(name.toLowerCase())) return;
        db.wifi_packages.push({
          id: `pkg_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId,
          name,
          speed: String(raw?.speed || '10 Mbps').trim(),
          price: Number(raw?.price) || 0,
          description: String(raw?.description ?? '').trim(),
          is_active: raw?.is_active !== false,
          createdAt: now,
        });
        existingPkgNames.add(name.toLowerCase());
        restoredPackages++;
      });
    }

    // 2. Restore Customers
    const customerNameMap = new Map<string, string>();
    db.customers
      .filter((c) => c.ownerId === ownerId)
      .forEach((c) => customerNameMap.set(c.name.toLowerCase(), c.id));

    if (Array.isArray(customers)) {
      customers.forEach((raw: any, i: number) => {
        const name = String(raw?.name ?? '').trim();
        const phone = String(raw?.phone ?? '').trim();
        if (!name || !phone) return;
        if (!isReplace && customerNameMap.has(name.toLowerCase())) return;

        const id = `cust_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const dueDay = Number(raw?.due_day);
        db.customers.push({
          id,
          ownerId,
          name,
          phone,
          address: String(raw?.address ?? '').trim(),
          package_name: String(raw?.package_name || 'Paket WiFi').trim(),
          monthly_fee: Number(raw?.monthly_fee) || 0,
          join_date: String(raw?.join_date || now.slice(0, 10)),
          status: raw?.status === 'inactive' ? 'inactive' : 'active',
          notes: String(raw?.notes ?? '').trim(),
          due_day: !isNaN(dueDay) && dueDay >= 1 && dueDay <= 28 ? dueDay : 10,
          pppoe_user: String(raw?.pppoe_user ?? '').trim(),
          odp_info: String(raw?.odp_info ?? '').trim(),
          maps_url: String(raw?.maps_url ?? '').trim(),
          createdAt: now,
        });
        customerNameMap.set(name.toLowerCase(), id);
        restoredCustomers++;
      });
    }

    // 3. Restore Payments
    if (Array.isArray(payments)) {
      const existingPaymentKeys = new Set(
        db.payments
          .filter((p) => p.ownerId === ownerId)
          .map((p) => `${p.customer_name.toLowerCase()}_${p.month}_${p.year}`)
      );

      payments.forEach((raw: any, i: number) => {
        const customer_name = String(raw?.customer_name ?? '').trim();
        const month = String(raw?.month ?? '').padStart(2, '0');
        const year = Number(raw?.year);
        if (!customer_name || !month || !year) return;

        const key = `${customer_name.toLowerCase()}_${month}_${year}`;
        if (!isReplace && existingPaymentKeys.has(key)) return;

        const matchedCustId =
          customerNameMap.get(customer_name.toLowerCase()) || `cust_unlinked_${i}`;
        const status: 'lunas' | 'belum_lunas' =
          raw?.status === 'lunas' ? 'lunas' : 'belum_lunas';

        db.payments.push({
          id: `pay_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId,
          customer_id: matchedCustId,
          customer_name,
          amount: Number(raw?.amount) || 0,
          month,
          year,
          payment_date: status === 'lunas' ? String(raw?.payment_date || now.slice(0, 10)) : '',
          method: status === 'lunas' ? (raw?.method || 'Cash') : '',
          status,
          notes: String(raw?.notes ?? '').trim(),
          createdAt: now,
        });
        existingPaymentKeys.add(key);
        restoredPayments++;
      });
    }

    // 4. Restore Expenses
    if (Array.isArray(expenses)) {
      expenses.forEach((raw: any, i: number) => {
        const description = String(raw?.description ?? '').trim();
        const amount = Number(raw?.amount);
        if (!description || isNaN(amount) || amount <= 0) return;

        db.expenses.push({
          id: `exp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId,
          description,
          amount,
          category: raw?.category || 'Operasional',
          expense_date: String(raw?.expense_date || now.slice(0, 10)),
          notes: String(raw?.notes ?? '').trim(),
          createdAt: now,
        });
        restoredExpenses++;
      });
    }

    saveDb(db);
    res.json({
      restoredCustomers,
      restoredPayments,
      restoredExpenses,
      restoredPackages,
      customers: db.customers.filter((c) => c.ownerId === ownerId),
      payments: db.payments.filter((p) => p.ownerId === ownerId),
      expenses: db.expenses.filter((e) => e.ownerId === ownerId),
      wifi_packages: db.wifi_packages.filter((p) => p.ownerId === ownerId),
    });
  });

  // Delete Account / Owner Data
  app.delete('/api/account', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const db = loadDb();
    db.customers = db.customers.filter((c) => c.ownerId !== ownerId);
    db.payments = db.payments.filter((p) => p.ownerId !== ownerId);
    db.expenses = db.expenses.filter((e) => e.ownerId !== ownerId);
    db.wifi_packages = db.wifi_packages.filter((p) => p.ownerId !== ownerId);
    delete db.app_settings[ownerId];
    saveDb(db);
    res.json({ success: true });
  });

  // WiFi Packages CRUD
  app.post('/api/packages', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { name, speed, price, description, is_active } = req.body;
    if (!name || !String(name).trim() || !speed || !String(speed).trim() || price === undefined || Number(price) < 0) {
      res.status(400).json({ error: 'Nama paket, kecepatan, dan harga wajib diisi dengan benar.' });
      return;
    }
    const db = loadDb();
    const newPkg: WifiPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId,
      name: String(name).trim(),
      speed: String(speed).trim(),
      price: Number(price),
      description: String(description ?? '').trim(),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      createdAt: new Date().toISOString(),
    };
    db.wifi_packages.push(newPkg);
    saveDb(db);
    res.status(201).json(newPkg);
  });

  app.put('/api/packages/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const { name, speed, price, description, is_active } = req.body;
    const db = loadDb();
    const idx = db.wifi_packages.findIndex((p) => p.id === id && p.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Paket WiFi tidak ditemukan atau akses ditolak.' });
      return;
    }
    if (!name || !String(name).trim() || !speed || !String(speed).trim() || price === undefined || Number(price) < 0) {
      res.status(400).json({ error: 'Nama paket, kecepatan, dan harga wajib diisi dengan benar.' });
      return;
    }
    db.wifi_packages[idx] = {
      ...db.wifi_packages[idx],
      name: String(name).trim(),
      speed: String(speed).trim(),
      price: Number(price),
      description: String(description ?? '').trim(),
      is_active: is_active !== undefined ? Boolean(is_active) : db.wifi_packages[idx].is_active,
    };
    saveDb(db);
    res.json(db.wifi_packages[idx]);
  });

  app.delete('/api/packages/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const db = loadDb();
    const idx = db.wifi_packages.findIndex((p) => p.id === id && p.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Paket WiFi tidak ditemukan.' });
      return;
    }
    db.wifi_packages.splice(idx, 1);
    saveDb(db);
    res.json({ success: true });
  });

  // Customers CRUD & Bulk Import
  app.post('/api/customers', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const {
      name,
      phone,
      address,
      package_name,
      monthly_fee,
      join_date,
      status,
      notes,
      due_day,
      pppoe_user,
      odp_info,
      maps_url,
    } = req.body;
    if (!name || !String(name).trim() || !phone || !String(phone).trim() || !package_name || !String(package_name).trim() || monthly_fee === undefined) {
      res.status(400).json({ error: 'Nama, nomor WhatsApp, paket WiFi, dan tarif bulanan wajib diisi.' });
      return;
    }
    const db = loadDb();
    const parsedDue = Number(due_day);
    const newCustomer: Customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId,
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: String(address ?? '').trim(),
      package_name: String(package_name).trim(),
      monthly_fee: Number(monthly_fee) || 0,
      join_date: String(join_date || new Date().toISOString().slice(0, 10)),
      status: status === 'inactive' ? 'inactive' : 'active',
      notes: String(notes ?? '').trim(),
      due_day: !isNaN(parsedDue) && parsedDue >= 1 && parsedDue <= 28 ? parsedDue : 10,
      pppoe_user: String(pppoe_user ?? '').trim(),
      odp_info: String(odp_info ?? '').trim(),
      maps_url: String(maps_url ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.customers.push(newCustomer);
    saveDb(db);
    res.status(201).json(newCustomer);
  });

  app.post('/api/customers/import', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Data impor harus berupa daftar pelanggan.' });
      return;
    }
    const db = loadDb();
    const created: Customer[] = [];
    const errors: { row: number; reason: string }[] = [];

    items.forEach((raw: any, index: number) => {
      const rowNum = index + 2;
      const name = String(raw?.name ?? '').trim();
      const phone = String(raw?.phone ?? '').trim();
      const package_name = String(raw?.package_name ?? '').trim();
      const monthly_fee = Number(raw?.monthly_fee);
      const statusRaw = String(raw?.status ?? 'active').trim().toLowerCase();

      if (!name) {
        errors.push({ row: rowNum, reason: 'Nama pelanggan kosong' });
        return;
      }
      if (!phone) {
        errors.push({ row: rowNum, reason: `Nomor WhatsApp untuk "${name}" kosong` });
        return;
      }
      if (!package_name) {
        errors.push({ row: rowNum, reason: `Paket WiFi untuk "${name}" kosong` });
        return;
      }
      if (isNaN(monthly_fee) || monthly_fee < 0) {
        errors.push({ row: rowNum, reason: `Tarif bulanan untuk "${name}" tidak valid` });
        return;
      }

      const status: 'active' | 'inactive' =
        statusRaw === 'inactive' || statusRaw === 'nonaktif' || statusRaw === 'tidak aktif'
          ? 'inactive'
          : 'active';

      const parsedDue = Number(raw?.due_day);
      const newCust: Customer = {
        id: `cust_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId,
        name,
        phone,
        address: String(raw?.address ?? '').trim(),
        package_name,
        monthly_fee,
        join_date: String(raw?.join_date || new Date().toISOString().slice(0, 10)),
        status,
        notes: String(raw?.notes ?? '').trim(),
        due_day: !isNaN(parsedDue) && parsedDue >= 1 && parsedDue <= 28 ? parsedDue : 10,
        pppoe_user: String(raw?.pppoe_user ?? '').trim(),
        odp_info: String(raw?.odp_info ?? '').trim(),
        maps_url: String(raw?.maps_url ?? '').trim(),
        createdAt: new Date().toISOString(),
      };
      db.customers.push(newCust);
      created.push(newCust);
    });

    if (created.length > 0) {
      saveDb(db);
    }

    res.json({
      importedCount: created.length,
      failedCount: errors.length,
      errors,
      customers: created,
    });
  });

  app.put('/api/customers/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      package_name,
      monthly_fee,
      join_date,
      status,
      notes,
      due_day,
      pppoe_user,
      odp_info,
      maps_url,
    } = req.body;
    const db = loadDb();
    const idx = db.customers.findIndex((c) => c.id === id && c.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }
    if (!name || !String(name).trim() || !phone || !String(phone).trim() || !package_name || !String(package_name).trim()) {
      res.status(400).json({ error: 'Nama, nomor WhatsApp, dan paket WiFi wajib diisi.' });
      return;
    }
    const updatedName = String(name).trim();
    const parsedDue = Number(due_day);
    db.customers[idx] = {
      ...db.customers[idx],
      name: updatedName,
      phone: String(phone).trim(),
      address: String(address ?? '').trim(),
      package_name: String(package_name).trim(),
      monthly_fee: Number(monthly_fee) || 0,
      join_date: String(join_date || db.customers[idx].join_date),
      status: status === 'inactive' ? 'inactive' : 'active',
      notes: String(notes ?? '').trim(),
      due_day:
        !isNaN(parsedDue) && parsedDue >= 1 && parsedDue <= 28
          ? parsedDue
          : (db.customers[idx].due_day ?? 10),
      pppoe_user:
        pppoe_user !== undefined
          ? String(pppoe_user).trim()
          : (db.customers[idx].pppoe_user ?? ''),
      odp_info:
        odp_info !== undefined
          ? String(odp_info).trim()
          : (db.customers[idx].odp_info ?? ''),
      maps_url:
        maps_url !== undefined
          ? String(maps_url).trim()
          : (db.customers[idx].maps_url ?? ''),
    };
    db.payments.forEach((p) => {
      if (p.ownerId === ownerId && p.customer_id === id) {
        p.customer_name = updatedName;
      }
    });
    saveDb(db);
    res.json(db.customers[idx]);
  });

  app.delete('/api/customers/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const db = loadDb();
    const idx = db.customers.findIndex((c) => c.id === id && c.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }
    db.customers.splice(idx, 1);
    saveDb(db);
    res.json({ success: true });
  });

  // Payments / Billing CRUD, Bulk Generation & Bulk Status Update
  app.post('/api/payments', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { customer_id, customer_name, amount, month, year, payment_date, method, status, notes } = req.body;
    if (!customer_id || !customer_name || amount === undefined || !month || !year) {
      res.status(400).json({ error: 'Pelanggan, periode bulan/tahun, dan jumlah tagihan wajib diisi.' });
      return;
    }
    const db = loadDb();
    const newPayment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId,
      customer_id: String(customer_id),
      customer_name: String(customer_name).trim(),
      amount: Number(amount) || 0,
      month: String(month).padStart(2, '0'),
      year: Number(year),
      payment_date: status === 'lunas' ? String(payment_date || new Date().toISOString().slice(0, 10)) : String(payment_date ?? ''),
      method: status === 'lunas' ? (method || 'Cash') : (method || ''),
      status: status === 'lunas' ? 'lunas' : 'belum_lunas',
      notes: String(notes ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.payments.push(newPayment);
    saveDb(db);
    res.status(201).json(newPayment);
  });

  app.post('/api/payments/bulk-generate', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { month, year, customer_ids } = req.body;
    if (!month || !year || !Array.isArray(customer_ids)) {
      res.status(400).json({ error: 'Periode bulan, tahun, dan daftar pelanggan wajib dipilih.' });
      return;
    }
    const normalizedMonth = String(month).padStart(2, '0');
    const numericYear = Number(year);
    const db = loadDb();

    const activeCustomers = db.customers.filter(
      (c) => c.ownerId === ownerId && c.status === 'active' && customer_ids.includes(c.id)
    );

    const existingCustomerIdsInPeriod = new Set(
      db.payments
        .filter((p) => p.ownerId === ownerId && p.month === normalizedMonth && p.year === numericYear)
        .map((p) => p.customer_id)
    );

    const created: Payment[] = [];
    let skippedCount = 0;

    activeCustomers.forEach((cust, idx) => {
      if (existingCustomerIdsInPeriod.has(cust.id)) {
        skippedCount++;
        return;
      }
      const newPay: Payment = {
        id: `pay_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId,
        customer_id: cust.id,
        customer_name: cust.name,
        amount: cust.monthly_fee,
        month: normalizedMonth,
        year: numericYear,
        payment_date: '',
        method: '',
        status: 'belum_lunas',
        notes: `Tagihan Paket ${cust.package_name}`,
        createdAt: new Date().toISOString(),
      };
      db.payments.push(newPay);
      existingCustomerIdsInPeriod.add(cust.id);
      created.push(newPay);
    });

    if (created.length > 0) {
      saveDb(db);
    }

    res.status(201).json({
      createdCount: created.length,
      skippedCount,
      payments: created,
    });
  });

  app.put('/api/payments/bulk-status', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { payment_ids, status, method, payment_date } = req.body;
    if (!Array.isArray(payment_ids) || !status) {
      res.status(400).json({ error: 'Daftar tagihan dan status baru wajib diisi.' });
      return;
    }
    const db = loadDb();
    const targetStatus: 'lunas' | 'belum_lunas' = status === 'lunas' ? 'lunas' : 'belum_lunas';
    const today = new Date().toISOString().slice(0, 10);
    const updated: Payment[] = [];

    db.payments.forEach((p) => {
      if (p.ownerId === ownerId && payment_ids.includes(p.id)) {
        p.status = targetStatus;
        if (targetStatus === 'lunas') {
          p.payment_date = payment_date || p.payment_date || today;
          p.method = method || p.method || 'Cash';
        } else {
          p.payment_date = '';
          p.method = '';
        }
        updated.push(p);
      }
    });

    saveDb(db);
    res.json({ updatedCount: updated.length, payments: updated });
  });

  app.put('/api/payments/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const { customer_id, customer_name, amount, month, year, payment_date, method, status, notes } = req.body;
    const db = loadDb();
    const idx = db.payments.findIndex((p) => p.id === id && p.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Data tagihan tidak ditemukan.' });
      return;
    }
    const targetStatus: 'lunas' | 'belum_lunas' = status === 'lunas' ? 'lunas' : 'belum_lunas';
    const today = new Date().toISOString().slice(0, 10);
    db.payments[idx] = {
      ...db.payments[idx],
      customer_id: String(customer_id ?? db.payments[idx].customer_id),
      customer_name: String(customer_name ?? db.payments[idx].customer_name).trim(),
      amount: amount !== undefined ? Number(amount) : db.payments[idx].amount,
      month: month ? String(month).padStart(2, '0') : db.payments[idx].month,
      year: year ? Number(year) : db.payments[idx].year,
      status: targetStatus,
      payment_date:
        targetStatus === 'lunas'
          ? String(payment_date || db.payments[idx].payment_date || today)
          : '',
      method:
        targetStatus === 'lunas'
          ? (method || db.payments[idx].method || 'Cash')
          : '',
      notes: notes !== undefined ? String(notes).trim() : db.payments[idx].notes,
    };
    saveDb(db);
    res.json(db.payments[idx]);
  });

  app.delete('/api/payments/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const db = loadDb();
    const idx = db.payments.findIndex((p) => p.id === id && p.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Data tagihan tidak ditemukan.' });
      return;
    }
    db.payments.splice(idx, 1);
    saveDb(db);
    res.json({ success: true });
  });

  // Expenses CRUD
  app.post('/api/expenses', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { description, amount, category, expense_date, notes } = req.body;
    if (!description || !String(description).trim() || amount === undefined || !category || !expense_date) {
      res.status(400).json({ error: 'Keterangan, jumlah, kategori, dan tanggal pengeluaran wajib diisi.' });
      return;
    }
    const db = loadDb();
    const newExpense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId,
      description: String(description).trim(),
      amount: Number(amount) || 0,
      category,
      expense_date: String(expense_date),
      notes: String(notes ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.expenses.push(newExpense);
    saveDb(db);
    res.status(201).json(newExpense);
  });

  app.put('/api/expenses/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const { description, amount, category, expense_date, notes } = req.body;
    const db = loadDb();
    const idx = db.expenses.findIndex((e) => e.id === id && e.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Data pengeluaran tidak ditemukan.' });
      return;
    }
    if (!description || !String(description).trim() || amount === undefined || !category || !expense_date) {
      res.status(400).json({ error: 'Keterangan, jumlah, kategori, dan tanggal pengeluaran wajib diisi.' });
      return;
    }
    db.expenses[idx] = {
      ...db.expenses[idx],
      description: String(description).trim(),
      amount: Number(amount) || 0,
      category,
      expense_date: String(expense_date),
      notes: String(notes ?? '').trim(),
    };
    saveDb(db);
    res.json(db.expenses[idx]);
  });

  app.delete('/api/expenses/:id', requireOwner, (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { id } = req.params;
    const db = loadDb();
    const idx = db.expenses.findIndex((e) => e.id === id && e.ownerId === ownerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Data pengeluaran tidak ditemukan.' });
      return;
    }
    db.expenses.splice(idx, 1);
    saveDb(db);
    res.json({ success: true });
  });

  // ============================================================================
  // MIKROTIK LIVE MONITORING & CONTROL ENDPOINTS
  // ============================================================================

  function getMikrotikConfigForOwner(
    db: DatabaseSchema,
    ownerId: string,
    overrideBody?: any
  ): MikrotikConnectionConfig {
    ensureOwnerInitialized(db, ownerId);
    const s = db.app_settings[ownerId];
    return {
      host: String(overrideBody?.host ?? s.mikrotik_host ?? '').trim(),
      port: Number(overrideBody?.port ?? s.mikrotik_port ?? 8728) || 8728,
      user: String(overrideBody?.user ?? s.mikrotik_user ?? 'admin').trim(),
      password:
        overrideBody?.password !== undefined
          ? String(overrideBody.password)
          : (s.mikrotik_password ?? ''),
      protocol: overrideBody?.protocol || s.mikrotik_protocol || 'api',
      timeoutMs: 8000,
    };
  }

  app.post('/api/mikrotik/test', requireOwner, async (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const db = loadDb();
    const config = getMikrotikConfigForOwner(db, ownerId, req.body);
    try {
      const info = await testMikrotikConnection(config);
      res.json({ connected: true, router: info });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Gagal menghubungi router MikroTik.' });
    }
  });

  app.get('/api/mikrotik/monitor', requireOwner, async (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const db = loadDb();
    const config = getMikrotikConfigForOwner(db, ownerId);

    try {
      const snap = await fetchMikrotikSnapshot(config);
      const ownerCustomers = db.customers.filter((c) => c.ownerId === ownerId);

      // Parse Router Resource Health
      const freeMemory = Number(snap.resource['free-memory'] || 0);
      const totalMemory = Number(snap.resource['total-memory'] || 0);
      const usedMemory = Math.max(0, totalMemory - freeMemory);
      const memoryUsagePercent =
        totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;

      const routerHealth = {
        identity: snap.identity || 'MikroTik Router',
        boardName: snap.resource['board-name'] || snap.resource.platform || 'RouterOS',
        version: snap.resource.version || '-',
        uptime: snap.resource.uptime || '-',
        cpuLoad: Number(snap.resource['cpu-load'] || 0),
        freeMemory,
        totalMemory,
        memoryUsagePercent,
      };

      // Build lookup maps from MikroTik data
      const activePppMap = new Map<string, Record<string, any>>();
      snap.pppActive.forEach((act) => {
        const name = String(act.name || '').trim().toLowerCase();
        if (name) activePppMap.set(name, act);
      });

      const secretPppMap = new Map<string, Record<string, any>>();
      snap.pppSecrets.forEach((sec) => {
        const name = String(sec.name || '').trim().toLowerCase();
        if (name) secretPppMap.set(name, sec);
      });

      // Simple Queue map by name AND by target IP
      const queueByNameMap = new Map<string, Record<string, any>>();
      const queueByIpMap = new Map<string, Record<string, any>>();
      snap.simpleQueues.forEach((q) => {
        const qName = String(q.name || '')
          .trim()
          .replace(/^<pppoe-/, '')
          .replace(/>$/, '')
          .toLowerCase();
        if (qName) queueByNameMap.set(qName, q);
        const targetIp = normalizeQueueTargetIp(q.target);
        if (targetIp) queueByIpMap.set(targetIp, q);
      });

      const netwatchByHost = new Map<string, Record<string, any>>();
      snap.netwatch.forEach((nw) => {
        const h = String(nw.host || '').trim();
        if (h) netwatchByHost.set(h, nw);
      });

      const arpByIp = new Map<string, Record<string, any>>();
      snap.arpList.forEach((arp) => {
        const ip = String(arp.address || '').trim();
        if (ip) arpByIp.set(ip, arp);
      });

      const matchedPppNames = new Set<string>();
      const matchedQueueIds = new Set<string>();
      const monitorItems: any[] = [];

      // 1. Match all registered Customers in app
      ownerCustomers.forEach((cust) => {
        const accountKey = (cust.pppoe_user || cust.name || '').trim();
        const lowerKey = accountKey.toLowerCase();
        const lowerName = cust.name.trim().toLowerCase();

        const secret = secretPppMap.get(lowerKey) || secretPppMap.get(lowerName);
        const activePpp = activePppMap.get(lowerKey) || activePppMap.get(lowerName);

        if (secret?.name) matchedPppNames.add(String(secret.name).toLowerCase());
        if (activePpp?.name) matchedPppNames.add(String(activePpp.name).toLowerCase());

        const ipAddress =
          activePpp?.address ||
          secret?.['remote-address'] ||
          (/^\d+\.\d+\.\d+\.\d+$/.test(accountKey) ? accountKey : '');

        const queue =
          queueByNameMap.get(lowerKey) ||
          queueByNameMap.get(lowerName) ||
          (ipAddress ? queueByIpMap.get(ipAddress) : undefined);

        if (queue?.['.id']) matchedQueueIds.add(String(queue['.id']));

        const netwatch = ipAddress ? netwatchByHost.get(ipAddress) : undefined;
        const arp = ipAddress ? arpByIp.get(ipAddress) : undefined;

        // Parse traffic rate & bytes from Simple Queue
        // Note: In MikroTik Simple Queue for client target, rate is "tx(upload)/rx(download)"
        const [qUploadRate, qDownloadRate] = parseMikrotikPairValue(queue?.rate);
        const [qUploadBytes, qDownloadBytes] = parseMikrotikPairValue(queue?.bytes);

        const isSecretDisabled =
          secret?.disabled === 'true' || secret?.disabled === 'yes' || secret?.disabled === true;
        const isQueueDisabled =
          queue?.disabled === 'true' || queue?.disabled === 'yes' || queue?.disabled === true;
        const isDisabled = isSecretDisabled || isQueueDisabled;

        let onlineStatus: 'online' | 'offline' | 'isolated' = 'offline';
        let sourceType: 'PPPoE' | 'Queue' | 'Netwatch' | 'ARP' | 'Unmatched' = 'Unmatched';

        if (secret || activePpp) {
          sourceType = 'PPPoE';
          if (isDisabled) {
            onlineStatus = 'isolated';
          } else if (activePpp) {
            onlineStatus = 'online';
          } else {
            onlineStatus = 'offline';
          }
        } else if (netwatch) {
          sourceType = 'Netwatch';
          onlineStatus = isDisabled
            ? 'isolated'
            : String(netwatch.status).toLowerCase() === 'up'
            ? 'online'
            : 'offline';
        } else if (arp) {
          sourceType = 'ARP';
          const isComplete =
            arp.complete === 'true' || arp.complete === 'yes' || arp.complete === true || Boolean(arp['mac-address']);
          onlineStatus = isDisabled ? 'isolated' : isComplete ? 'online' : 'offline';
        } else if (queue) {
          sourceType = 'Queue';
          onlineStatus = isDisabled
            ? 'isolated'
            : qDownloadRate > 0 || qUploadRate > 0
            ? 'online'
            : 'offline';
        }

        const uptimeStr = activePpp?.uptime || '';
        const macAddr =
          activePpp?.['caller-id'] || arp?.['mac-address'] || secret?.['caller-id'] || '-';

        monitorItems.push({
          key: `cust_${cust.id}`,
          customerId: cust.id,
          customerName: cust.name,
          phone: cust.phone,
          packageName: cust.package_name,
          odpInfo: cust.odp_info || '',
          mapsUrl: cust.maps_url || '',
          targetAccount: secret?.name || activePpp?.name || accountKey || cust.name,
          sourceType,
          onlineStatus,
          ipAddress: ipAddress || '-',
          macAddress: macAddr,
          uptime: uptimeStr || '-',
          uptimeSeconds: parseRouterOsUptimeToSeconds(uptimeStr),
          rxRateBps: qDownloadRate,
          txRateBps: qUploadRate,
          rxBytes: qDownloadBytes,
          txBytes: qUploadBytes,
          secretId: secret?.['.id'],
          activeSessionId: activePpp?.['.id'],
          queueId: queue?.['.id'],
          isDisabled,
          comment: secret?.comment || queue?.comment || '',
        });
      });

      // 2. Also include any remaining PPPoE Secrets / Active sessions in MikroTik not yet linked to a Customer
      snap.pppSecrets.forEach((sec) => {
        const sName = String(sec.name || '').trim();
        if (!sName || matchedPppNames.has(sName.toLowerCase())) return;
        matchedPppNames.add(sName.toLowerCase());

        const activePpp = activePppMap.get(sName.toLowerCase());
        const ipAddress = activePpp?.address || sec['remote-address'] || '';
        const queue =
          queueByNameMap.get(sName.toLowerCase()) ||
          (ipAddress ? queueByIpMap.get(ipAddress) : undefined);
        if (queue?.['.id']) matchedQueueIds.add(String(queue['.id']));

        const [qUploadRate, qDownloadRate] = parseMikrotikPairValue(queue?.rate);
        const [qUploadBytes, qDownloadBytes] = parseMikrotikPairValue(queue?.bytes);
        const isDisabled =
          sec.disabled === 'true' || sec.disabled === 'yes' || sec.disabled === true;
        const uptimeStr = activePpp?.uptime || '';

        monitorItems.push({
          key: `ppp_${sec['.id'] || sName}`,
          customerName: sec.comment ? `${sName} (${sec.comment})` : sName,
          packageName: sec.profile || 'PPPoE MikroTik',
          targetAccount: sName,
          sourceType: 'PPPoE',
          onlineStatus: isDisabled ? 'isolated' : activePpp ? 'online' : 'offline',
          ipAddress: ipAddress || '-',
          macAddress: activePpp?.['caller-id'] || sec['caller-id'] || '-',
          uptime: uptimeStr || '-',
          uptimeSeconds: parseRouterOsUptimeToSeconds(uptimeStr),
          rxRateBps: qDownloadRate,
          txRateBps: qUploadRate,
          rxBytes: qDownloadBytes,
          txBytes: qUploadBytes,
          secretId: sec['.id'],
          activeSessionId: activePpp?.['.id'],
          queueId: queue?.['.id'],
          isDisabled,
          comment: sec.comment || '',
        });
      });

      // 3. Include remaining Simple Queues not yet matched
      snap.simpleQueues.forEach((q) => {
        const qId = String(q['.id'] || '');
        if (!qId || matchedQueueIds.has(qId)) return;
        const qName = String(q.name || '').trim();
        // Skip dynamic pppoe queues already covered
        if (qName.startsWith('<pppoe-')) return;

        const targetIp = normalizeQueueTargetIp(q.target);
        const arp = targetIp ? arpByIp.get(targetIp) : undefined;
        const netwatch = targetIp ? netwatchByHost.get(targetIp) : undefined;

        const [qUploadRate, qDownloadRate] = parseMikrotikPairValue(q.rate);
        const [qUploadBytes, qDownloadBytes] = parseMikrotikPairValue(q.bytes);
        const isDisabled = q.disabled === 'true' || q.disabled === 'yes' || q.disabled === true;

        let onlineStatus: 'online' | 'offline' | 'isolated' = 'offline';
        if (isDisabled) {
          onlineStatus = 'isolated';
        } else if (netwatch) {
          onlineStatus = String(netwatch.status).toLowerCase() === 'up' ? 'online' : 'offline';
        } else if (qDownloadRate > 0 || qUploadRate > 0 || arp) {
          onlineStatus = 'online';
        }

        monitorItems.push({
          key: `queue_${qId}`,
          customerName: q.comment ? `${qName} (${q.comment})` : qName,
          packageName: 'Simple Queue',
          targetAccount: targetIp || qName,
          sourceType: 'Queue',
          onlineStatus,
          ipAddress: targetIp || '-',
          macAddress: arp?.['mac-address'] || '-',
          uptime: '-',
          uptimeSeconds: 0,
          rxRateBps: qDownloadRate,
          txRateBps: qUploadRate,
          rxBytes: qDownloadBytes,
          txBytes: qUploadBytes,
          queueId: qId,
          isDisabled,
          comment: q.comment || '',
        });
      });

      res.json({
        connected: true,
        timestamp: new Date().toISOString(),
        router: routerHealth,
        items: monitorItems,
      });
    } catch (err: any) {
      res.status(400).json({
        error: err?.message || 'Gagal mengambil data monitoring dari MikroTik.',
      });
    }
  });

  app.post('/api/mikrotik/action', requireOwner, async (req, res) => {
    const ownerId = (req as any).ownerId as string;
    const { action, secretId, activeSessionId, queueId, targetAccount } = req.body;
    if (!action || !['isolate', 'unisolate', 'kick'].includes(action)) {
      res.status(400).json({ error: 'Aksi MikroTik tidak valid.' });
      return;
    }
    const db = loadDb();
    const config = getMikrotikConfigForOwner(db, ownerId);

    try {
      const result = await executeMikrotikControlAction(config, action, {
        secretId,
        activeSessionId,
        queueId,
        targetAccount,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        error: err?.message || 'Gagal mengeksekusi perintah ke MikroTik.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple Billing Mini ISP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

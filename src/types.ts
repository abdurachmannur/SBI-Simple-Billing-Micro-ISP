export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  address: string;
  package_name: string;
  monthly_fee: number;
  join_date: string;
  status: CustomerStatus;
  notes: string;
  due_day?: number; // 1 .. 28, default 10
  pppoe_user?: string; // Username PPPoE atau IP Statis di MikroTik
  odp_info?: string; // Kode ODP / Port / Perangkat ONT
  maps_url?: string; // Link koordinat Google Maps
  createdAt?: string;
}

export type PaymentMethod =
  | 'Cash'
  | 'DANA'
  | 'BRI'
  | 'Mandiri'
  | 'Gateway'
  | 'Rekening Lain'
  | '';

export type PaymentStatus = 'lunas' | 'belum_lunas';

export interface Payment {
  id: string;
  ownerId: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  month: string; // "01" .. "12"
  year: number;
  payment_date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string;
  createdAt?: string;
}

export type ExpenseCategory =
  | 'Operasional'
  | 'Maintenance'
  | 'Perangkat'
  | 'Internet/ISP'
  | 'Listrik'
  | 'Lainnya';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Operasional',
  'Maintenance',
  'Perangkat',
  'Internet/ISP',
  'Listrik',
  'Lainnya',
];

export const PAYMENT_METHODS: Exclude<PaymentMethod, ''>[] = [
  'Cash',
  'DANA',
  'BRI',
  'Mandiri',
  'Gateway',
  'Rekening Lain',
];

export interface Expense {
  id: string;
  ownerId: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  notes: string;
  createdAt?: string;
}

export interface WifiPackage {
  id: string;
  ownerId: string;
  name: string;
  speed: string;
  price: number;
  description: string;
  is_active: boolean;
  createdAt?: string;
}

export type MikrotikProtocol = 'api' | 'api-ssl' | 'rest-http' | 'rest-https';

export interface AppSettings {
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
  mikrotik_protocol?: MikrotikProtocol;
}

export interface MikrotikRouterHealth {
  identity: string;
  boardName: string;
  version: string;
  uptime: string;
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  memoryUsagePercent: number;
}

export interface MikrotikCustomerMonitorItem {
  key: string;
  customerId?: string;
  customerName: string;
  phone?: string;
  packageName?: string;
  odpInfo?: string;
  mapsUrl?: string;
  targetAccount: string; // PPPoE username or Static IP
  sourceType: 'PPPoE' | 'Queue' | 'Netwatch' | 'ARP' | 'Binding' | 'Unmatched';
  onlineStatus: 'online' | 'offline' | 'isolated';
  ipAddress: string;
  macAddress: string;
  uptime: string;
  uptimeSeconds: number;
  rxRateBps: number; // Download bps (to customer)
  txRateBps: number; // Upload bps (from customer)
  rxBytes: number;
  txBytes: number;
  secretId?: string;
  activeSessionId?: string;
  queueId?: string;
  isDisabled: boolean;
  comment?: string;
}

export interface MikrotikMonitorResponse {
  connected: boolean;
  timestamp: string;
  router: MikrotikRouterHealth;
  items: MikrotikCustomerMonitorItem[];
}

export type NavTab =
  | 'dashboard'
  | 'customers'
  | 'billing'
  | 'monitoring'
  | 'expenses'
  | 'packages'
  | 'settings';

export const INDONESIAN_MONTHS: { value: string; label: string; short: string }[] = [
  { value: '01', label: 'Januari', short: 'Jan' },
  { value: '02', label: 'Februari', short: 'Feb' },
  { value: '03', label: 'Maret', short: 'Mar' },
  { value: '04', label: 'April', short: 'Apr' },
  { value: '05', label: 'Mei', short: 'Mei' },
  { value: '06', label: 'Juni', short: 'Jun' },
  { value: '07', label: 'Juli', short: 'Jul' },
  { value: '08', label: 'Agustus', short: 'Agu' },
  { value: '09', label: 'September', short: 'Sep' },
  { value: '10', label: 'Oktober', short: 'Okt' },
  { value: '11', label: 'November', short: 'Nov' },
  { value: '12', label: 'Desember', short: 'Des' },
];

import {
  AppSettings,
  AppVersionInfo,
  AuthSessionInfo,
  Customer,
  Expense,
  GitHubUpdateCheckResponse,
  GitHubUpdateExecuteResponse,
  MikrotikMonitorResponse,
  MikrotikProtocol,
  Payment,
  PublicBrandingInfo,
  WifiPackage,
} from './types';

export const AUTH_TOKEN_STORAGE_KEY = 'sb_mini_isp_auth_token';

let unauthorizedHandler: ((reason?: string) => void) | null = null;

export function setUnauthorizedHandler(fn: ((reason?: string) => void) | null) {
  unauthorizedHandler = fn;
}

export function getStoredAuthToken(): string {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
}

export function setStoredAuthToken(token: string) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

function getHeaders(ownerId: string): HeadersInit {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-owner-id': ownerId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    extra?: { code?: string; remainingAttempts?: number; retryAfterSeconds?: number }
  ) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.remainingAttempts = extra?.remainingAttempts;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
  }
}

async function handleResponse<T>(res: Response, skipAuthRedirect = false): Promise<T> {
  if (!res.ok) {
    let errMsg = 'Terjadi kesalahan pada server.';
    let code: string | undefined;
    let remainingAttempts: number | undefined;
    let retryAfterSeconds: number | undefined;

    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
      if (data?.code) code = data.code;
      if (typeof data?.remainingAttempts === 'number') remainingAttempts = data.remainingAttempts;
      if (typeof data?.retryAfterSeconds === 'number') retryAfterSeconds = data.retryAfterSeconds;
    } catch {
      // ignore json parse failure
    }

    if (res.status === 401 && !skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler(errMsg);
    }

    throw new ApiError(errMsg, res.status, { code, remainingAttempts, retryAfterSeconds });
  }
  return res.json() as Promise<T>;
}

export interface BootstrapResponse {
  settings: AppSettings;
  wifi_packages: WifiPackage[];
  customers: Customer[];
  payments: Payment[];
  expenses: Expense[];
}

export const api = {
  // Public Branding & Production Auth
  getPublicBranding: async (ownerId: string): Promise<PublicBrandingInfo> => {
    const res = await fetch('/api/auth/public-branding', {
      headers: { 'x-owner-id': ownerId },
    });
    return handleResponse<PublicBrandingInfo>(res, true);
  },

  login: async (
    ownerId: string,
    payload: { username: string; password: string }
  ): Promise<AuthSessionInfo> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-id': ownerId,
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<AuthSessionInfo>(res, true);
  },

  getSession: async (ownerId: string): Promise<AuthSessionInfo> => {
    const res = await fetch('/api/auth/session', {
      headers: getHeaders(ownerId),
    });
    return handleResponse<AuthSessionInfo>(res, true);
  },

  logout: async (ownerId: string): Promise<{ success: boolean }> => {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res, true);
  },

  changeAdminCredentials: async (
    ownerId: string,
    payload: { currentPassword: string; newUsername: string; newPassword: string }
  ): Promise<{
    success: boolean;
    username: string;
    mustChangePassword: boolean;
    token: string;
    message: string;
  }> => {
    const res = await fetch('/api/auth/change-credentials', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, true);
  },

  bootstrap: async (ownerId: string): Promise<BootstrapResponse> => {
    const res = await fetch('/api/bootstrap', {
      headers: getHeaders(ownerId),
    });
    return handleResponse<BootstrapResponse>(res);
  },

  uploadLogo: async (ownerId: string, dataUrl: string): Promise<{ logo_url: string }> => {
    const res = await fetch('/api/upload-logo', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify({ dataUrl }),
    });
    return handleResponse<{ logo_url: string }>(res);
  },

  updateSettings: async (ownerId: string, settings: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(settings),
    });
    return handleResponse<AppSettings>(res);
  },

  restoreBackup: async (
    ownerId: string,
    payload: {
      mode: 'merge' | 'replace';
      customers: Partial<Customer>[];
      payments: Partial<Payment>[];
      expenses: Partial<Expense>[];
      wifi_packages: Partial<WifiPackage>[];
    }
  ): Promise<{
    customersCount: number;
    paymentsCount: number;
    expensesCount: number;
    packagesCount: number;
    restoredCustomers: number;
    restoredPayments: number;
    restoredExpenses: number;
    restoredPackages: number;
    customers: Customer[];
    payments: Payment[];
    expenses: Expense[];
    wifi_packages: WifiPackage[];
  }> => {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  deleteAccountData: async (ownerId: string): Promise<{ success: boolean }> => {
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Packages
  createPackage: async (ownerId: string, pkg: Omit<WifiPackage, 'id' | 'ownerId'>): Promise<WifiPackage> => {
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(pkg),
    });
    return handleResponse<WifiPackage>(res);
  },

  updatePackage: async (ownerId: string, id: string, pkg: Partial<WifiPackage>): Promise<WifiPackage> => {
    const res = await fetch(`/api/packages/${id}`, {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(pkg),
    });
    return handleResponse<WifiPackage>(res);
  },

  deletePackage: async (ownerId: string, id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/packages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Customers
  createCustomer: async (ownerId: string, customer: Omit<Customer, 'id' | 'ownerId'>): Promise<Customer> => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(customer),
    });
    return handleResponse<Customer>(res);
  },

  importCustomers: async (
    ownerId: string,
    items: Partial<Customer>[]
  ): Promise<{
    importedCount: number;
    failedCount: number;
    errors: { row: number; reason: string }[];
    customers: Customer[];
  }> => {
    const res = await fetch('/api/customers/import', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify({ items }),
    });
    return handleResponse(res);
  },

  updateCustomer: async (ownerId: string, id: string, customer: Partial<Customer>): Promise<Customer> => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(customer),
    });
    return handleResponse<Customer>(res);
  },

  deleteCustomer: async (ownerId: string, id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Payments / Billing
  createPayment: async (ownerId: string, payment: Omit<Payment, 'id' | 'ownerId'>): Promise<Payment> => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payment),
    });
    return handleResponse<Payment>(res);
  },

  bulkGeneratePayments: async (
    ownerId: string,
    payload: { month: string; year: number; customer_ids: string[] }
  ): Promise<{ createdCount: number; skippedCount: number; payments: Payment[] }> => {
    const res = await fetch('/api/payments/bulk-generate', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  bulkUpdatePaymentStatus: async (
    ownerId: string,
    payload: {
      payment_ids: string[];
      status: 'lunas' | 'belum_lunas';
      method?: string;
      payment_date?: string;
    }
  ): Promise<{ updatedCount: number; payments: Payment[] }> => {
    const res = await fetch('/api/payments/bulk-status', {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  updatePayment: async (ownerId: string, id: string, payment: Partial<Payment>): Promise<Payment> => {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payment),
    });
    return handleResponse<Payment>(res);
  },

  deletePayment: async (ownerId: string, id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Expenses
  createExpense: async (ownerId: string, expense: Omit<Expense, 'id' | 'ownerId'>): Promise<Expense> => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(expense),
    });
    return handleResponse<Expense>(res);
  },

  updateExpense: async (ownerId: string, id: string, expense: Partial<Expense>): Promise<Expense> => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: getHeaders(ownerId),
      body: JSON.stringify(expense),
    });
    return handleResponse<Expense>(res);
  },

  deleteExpense: async (ownerId: string, id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers: getHeaders(ownerId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // MikroTik API
  testMikrotik: async (
    ownerId: string,
    config?: {
      host: string;
      port: number;
      user: string;
      password?: string;
      protocol: MikrotikProtocol;
    }
  ): Promise<{
    connected: boolean;
    router: {
      identity: string;
      boardName: string;
      board_name?: string;
      version: string;
      uptime: string;
      cpuLoad: number;
      cpu_load?: number;
      memoryUsagePercent?: number;
      memory_used_percent?: number;
    };
  }> => {
    const res = await fetch('/api/mikrotik/test', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(config || {}),
    });
    return handleResponse(res);
  },

  getMikrotikMonitor: async (ownerId: string): Promise<MikrotikMonitorResponse> => {
    const res = await fetch('/api/mikrotik/monitor', {
      headers: getHeaders(ownerId),
    });
    return handleResponse<MikrotikMonitorResponse>(res);
  },

  executeMikrotikAction: async (
    ownerId: string,
    payload: {
      action: 'isolate' | 'unisolate' | 'kick';
      secretId?: string;
      activeSessionId?: string;
      queueId?: string;
      targetAccount?: string;
    }
  ): Promise<{ message: string }> => {
    const res = await fetch('/api/mikrotik/action', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ message: string }>(res);
  },

  // System Version & GitHub Update (Anti-RCE Hardened)
  getSystemVersion: async (ownerId: string): Promise<AppVersionInfo> => {
    const res = await fetch('/api/system/version', {
      headers: getHeaders(ownerId),
    });
    return handleResponse<AppVersionInfo>(res);
  },

  checkGitHubUpdate: async (
    ownerId: string,
    payload: { repoUrl: string; branch: string }
  ): Promise<GitHubUpdateCheckResponse> => {
    const res = await fetch('/api/system/github-check', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse<GitHubUpdateCheckResponse>(res);
  },

  executeGitHubUpdate: async (
    ownerId: string,
    payload: { repoUrl: string; branch: string }
  ): Promise<GitHubUpdateExecuteResponse> => {
    const res = await fetch('/api/system/github-update', {
      method: 'POST',
      headers: getHeaders(ownerId),
      body: JSON.stringify(payload),
    });
    return handleResponse<GitHubUpdateExecuteResponse>(res);
  },
};

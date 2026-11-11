import { GATEWAY_URL } from './jobs-client';

/**
 * Accounts & billing client. The session lives in an HttpOnly cookie set by the
 * gateway, so every call uses credentials: 'include' and JS never sees the token.
 */

export type PlanId = 'free' | 'pro' | 'team';

export interface AccountUser {
  id: string;
  email: string;
  plan: PlanId;
  planStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBillingAccount: boolean;
}

export interface AccountDetails {
  user: AccountUser;
  usage: { cloudTasksToday: number; cloudTasksPerDay: number | null; maxFileMb: number };
  activeSessions: number;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError('Could not reach EyeShots. Check your connection and try again.', 0, 'NETWORK');
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new ApiError(json?.error || `Request failed (HTTP ${res.status})`, res.status, json?.code);
  return json as T;
}

const post = <T>(path: string, body?: unknown) => call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const accountApi = {
  me: () => call<{ user: AccountUser }>('/api/auth/me'),
  requestCode: (email: string) => post<{ ok: true; expiresInMinutes: number }>('/api/auth/request-code', { email }),
  verify: (email: string, code: string) => post<{ ok: true; newAccount: boolean }>('/api/auth/verify', { email, code }),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  logoutAll: () => post<{ ok: true }>('/api/auth/logout-all'),
  details: () => call<AccountDetails>('/api/account'),
  exportUrl: () => `${GATEWAY_URL}/api/account/export`,
  deleteAccount: () => call<{ ok: true }>('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
  checkout: (plan: 'pro' | 'team', interval: 'month' | 'year') => post<{ url: string; alreadySubscribed?: boolean }>('/api/billing/checkout', { plan, interval }),
  portal: () => post<{ url: string }>('/api/billing/portal'),
};

export const PLAN_LABEL: Record<PlanId, string> = { free: 'Free', pro: 'Pro', team: 'Business' };

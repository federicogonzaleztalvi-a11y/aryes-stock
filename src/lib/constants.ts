// ─── Supabase config — single source of truth ────────────────────────────────
// Values come from environment variables. No fallbacks — the app throws
// immediately on startup if either is missing.
// Dev: .env.local (gitignored). Prod: Vercel dashboard → Env Vars.

import type { AlertCfg } from '../types.js';

function requireEnv(name: string): string {
  // @ts-ignore — import.meta.env is provided by Vite at build time
  const val = import.meta.env[name];
  if (!val) {
    throw new Error(
      `[Aryes] Missing required environment variable: ${name}\n` +
      `Set it in .env.local (dev) or Vercel dashboard (production).`
    );
  }
  return val;
}

export const SB_URL = requireEnv('VITE_SUPABASE_URL');
export const SKEY   = requireEnv('VITE_SUPABASE_ANON_KEY');

// ─── Auth headers ─────────────────────────────────────────────────────────────
// CRITICAL: apikey must always be the anon key (SKEY).
// The user JWT goes only in Authorization — never in apikey.
export const getAuthHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token: string | undefined = session?.access_token;
    return {
      'apikey': SKEY,
      'Authorization': `Bearer ${token || SKEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  } catch {
    return { 'apikey': SKEY, 'Authorization': `Bearer ${SKEY}`, 'Content-Type': 'application/json', ...extra };
  }
};

// ─── LS — localStorage cache ──────────────────────────────────────────────────
// Supabase is the source of truth. localStorage is a read cache populated by
// AppContext on login and updated optimistically on every mutation.
export const LS = {
  get<T>(key: string, def: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return def;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    } catch { return def; }
  },

  set(key: string, value: unknown): void {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
    } catch { /* never block */ }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch { /* never block */ }
  },
};

// ─── db — typed Supabase REST client ─────────────────────────────────────────
// Generic methods: callers declare the expected return type.
//   const products = await db.get<DbProduct[]>('products');
export const db = {
  async get<T = unknown>(table: string, query = ''): Promise<T> {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      headers: getAuthHeaders({ 'Prefer': 'return=representation' }),
    });
    return r.ok ? (r.json() as Promise<T>) : ([] as unknown as T);
  },

  async upsert<T = unknown>(table: string, data: unknown, conflictCol = ''): Promise<T | null> {
    const url = `${SB_URL}/rest/v1/${table}${conflictCol ? `?on_conflict=${conflictCol}` : ''}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({})) as { message?: string };
      console.warn('[db] upsert failed:', table, e?.message || r.status);
    }
    return r.ok ? (r.json() as Promise<T>) : null;
  },

  async patch<T = unknown>(table: string, data: unknown, match: string | Record<string, unknown>): Promise<T | null> {
    const query = typeof match === 'string'
      ? match
      : Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join('&');
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({})) as { message?: string };
      console.warn('[db] patch failed:', table, e?.message || r.status);
    }
    return r.ok ? (r.json() as Promise<T>) : null;
  },

  async del(table: string, match: Record<string, unknown>): Promise<void> {
    const query = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join('&');
    await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  async insert<T = unknown>(table: string, row: unknown): Promise<T | null> {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Prefer': 'return=representation,resolution=ignore-duplicates' }),
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({})) as { message?: string };
      console.warn('[db] insert failed:', table, e?.message || r.status);
    }
    return r.ok ? (r.json() as Promise<T>) : null;
  },

  async insertMany(table: string, rows: unknown[]): Promise<void> {
    if (!rows.length) return;
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const e = await r.text();
      throw new Error(`db.insertMany ${table}: ${e}`);
    }
  },

  // Optimistic concurrency: only patches if lockField still equals lockValue.
  // Prevents stale-read stock overwrites under concurrent writes.
  // On conflict (0 rows updated): re-fetches, recalculates delta, retries.
  async patchWithLock<T extends Record<string, unknown>>(
    table: string,
    data: Partial<T>,
    filter: string,
    lockField: keyof T,
    lockValue: number,
    maxRetries = 3,
  ): Promise<T | undefined> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const lockFilter = `${filter}&${String(lockField)}=eq.${lockValue}`;
      const r = await fetch(`${SB_URL}/rest/v1/${table}?${lockFilter}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation,count=exact' },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const e = await r.text();
        throw new Error(`patchWithLock ${table}: ${e}`);
      }
      const rows = await r.json() as T[];
      if (rows.length > 0) return rows[0];

      if (attempt < maxRetries - 1) {
        const fresh = await this.get<T[]>(`${table}?${filter}`);
        if (!fresh?.[0]) throw new Error('patchWithLock: row not found');
        const delta = (data as Record<string, number>).stock !== undefined
          ? (data as Record<string, number>).stock - lockValue
          : 0;
        lockValue = fresh[0][lockField] as number;
        if ((data as Record<string, number>).stock !== undefined) {
          (data as Record<string, number>).stock = lockValue + delta;
        }
      } else {
        throw new Error(`patchWithLock: conflict after ${maxRetries} retries`);
      }
    }
  },
};

// ─── Alert severity config ────────────────────────────────────────────────────
export const ALERT_CFG: AlertCfg = {
  order_now:  { label: 'Pedir YA',     dot: '#dc2626', bg: '#fef2f2', bd: '#fecaca', txt: '#dc2626', pri: 3 },
  order_soon: { label: 'Pedir pronto', dot: '#d97706', bg: '#fffbeb', bd: '#fde68a', txt: '#d97706', pri: 2 },
  watch:      { label: 'Vigilar',      dot: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe', txt: '#2563eb', pri: 1 },
  ok:         { label: 'Normal',       dot: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0', txt: '#16a34a', pri: 0 },
};

export const tfCols: readonly string[] = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

// ─── sanitizeText ─────────────────────────────────────────────────────────────
export const sanitizeText = (str: unknown, maxLen = 200): string => {
  if (!str) return '';
  return String(str).trim().replace(/\s+/g, ' ').slice(0, maxLen);
};

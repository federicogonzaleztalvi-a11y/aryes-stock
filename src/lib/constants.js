// ─── Supabase config — single source of truth ────────────────────────────────
// Values come from environment variables. No fallbacks — the app throws
// immediately on startup if either is missing. This prevents silent operation
// against a wrong or missing Supabase project.
// Dev: set in .env.local (gitignored). Prod: Vercel dashboard → Env Vars.
function requireEnv(name) {
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
// Reads the live session token from localStorage on every call so headers
// stay fresh after a JWT refresh.
// CRITICAL: apikey must always be the anon key (SKEY).
// The user JWT goes only in Authorization — never in apikey.
export const getAuthHeaders = (extra = {}) => {
  // apikey is always the public anon key — identifies the Supabase project.
  // Authorization must be the user's JWT. If there is no valid session,
  // we throw immediately so the caller fails explicitly rather than making
  // a request as the 'anon' role, which would silently bypass authenticated RLS.
  const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
  const token = session?.access_token;
  if (!token) {
    throw new Error('[auth] No active session — request aborted');
  }
  return {
    'apikey': SKEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
};

// ─── LS — localStorage cache ──────────────────────────────────────────────────
// Supabase is the source of truth. localStorage is a read cache populated by
// AppContext on login and updated optimistically on every mutation.
export const LS = {
  get(key, def) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return def;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch { return def; }
  },

  set(key, value) {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
    } catch { /* never block */ }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* never block */ }
  },
};

// ─── db — Supabase REST client ────────────────────────────────────────────────
export const db = {
  async get(table, query = '') {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      headers: getAuthHeaders({ 'Prefer': 'return=representation' }),
    });
    return r.ok ? r.json() : [];
  },

  async upsert(table, data, conflictCol = '') {
    const url = `${SB_URL}/rest/v1/${table}${conflictCol ? `?on_conflict=${conflictCol}` : ''}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      console.warn('[db] upsert failed:', table, e?.message || r.status);
    }
    return r.ok ? r.json() : null;
  },

  async patch(table, data, match) {
    const query = typeof match === 'string'
      ? match
      : Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join('&');
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      console.warn('[db] patch failed:', table, e?.message || r.status);
    }
    return r.ok ? r.json() : null;
  },

  async del(table, match) {
    const query = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join('&');
    await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  async insert(table, row) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Prefer': 'return=representation,resolution=ignore-duplicates' }),
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      console.warn('[db] insert failed:', table, e?.message || r.status);
    }
    return r.ok ? r.json() : null;
  },

  async insertMany(table, rows) {
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
  async patchWithLock(table, data, filter, lockField, lockValue, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const lockFilter = `${filter}&${lockField}=eq.${lockValue}`;
      const r = await fetch(`${SB_URL}/rest/v1/${table}?${lockFilter}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Prefer': 'return=representation,count=exact' },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const e = await r.text();
        throw new Error(`patchWithLock ${table}: ${e}`);
      }
      const rows = await r.json();
      if (rows.length > 0) return rows[0];

      if (attempt < maxRetries - 1) {
        const fresh = await this.get(`${table}?${filter}`);
        if (!fresh?.[0]) throw new Error('patchWithLock: row not found');
        const delta = data.stock !== undefined ? data.stock - lockValue : 0;
        lockValue = fresh[0][lockField];
        if (data.stock !== undefined) data = { ...data, stock: lockValue + delta };
      } else {
        throw new Error(`patchWithLock: conflict after ${maxRetries} retries`);
      }
    }
  },
};

// ─── Alert severity config ────────────────────────────────────────────────────
export const ALERT_CFG = {
  order_now:  { label: 'Pedir YA',     dot: '#dc2626', bg: '#fef2f2', bd: '#fecaca', txt: '#dc2626', pri: 3 },
  order_soon: { label: 'Pedir pronto', dot: '#d97706', bg: '#fffbeb', bd: '#fde68a', txt: '#d97706', pri: 2 },
  watch:      { label: 'Vigilar',      dot: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe', txt: '#2563eb', pri: 1 },
  ok:         { label: 'Normal',       dot: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0', txt: '#16a34a', pri: 0 },
};

export const tfCols = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

// ─── sanitizeText ─────────────────────────────────────────────────────────────
export const sanitizeText = (str, maxLen = 200) => {
  if (!str) return '';
  return String(str).trim().replace(/\s+/g, ' ').slice(0, maxLen);
};

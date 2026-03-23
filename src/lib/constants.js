// ─── Single source of truth for Supabase config ──────────────────────────────
// All files import SB_URL and SKEY from here — never hardcode inline.
// Values come from environment variables (Vite exposes VITE_* to the browser).
// Fallback to hardcoded only in case of misconfigured env (should not happen in prod).

export const SB_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://mrotnqybqvmvlexncvno.supabase.co';

export const SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI';

// ─── Auth headers helper ──────────────────────────────────────────────────────
// Reads the live session token from localStorage on every call so it's
// always fresh after a JWT refresh.
export const getAuthHeaders = (extra = {}) => {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token = session?.access_token;
    // CRITICAL: apikey must ALWAYS be the anon key (SKEY).
    // The user JWT goes only in Authorization — never in apikey.
    const base = {
      'apikey': SKEY,
      'Authorization': `Bearer ${token || SKEY}`,
      'Content-Type': 'application/json',
    };
    return { ...base, ...extra };
  } catch {
    return { 'apikey': SKEY, 'Authorization': `Bearer ${SKEY}`, 'Content-Type': 'application/json', ...extra };
  }
};

// ─── aryes_data blob sync (legacy layer) ─────────────────────────────────────
// Writes a key/value pair to the aryes_data table asynchronously.
// Used by LS.set — never blocks the UI.
function sbWrite(key, value) {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token = session?.access_token || SKEY;
    fetch(`${SB_URL}/rest/v1/aryes_data`, {
      method: 'POST',
      headers: {
        'apikey': SKEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  } catch { /* never block */ }
}

// Reads all rows from aryes_data and hydrates localStorage cache.
// Called once on app load to pull any server-side changes.
export async function sbSyncAll() {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token = session?.access_token || SKEY;
    const r = await fetch(`${SB_URL}/rest/v1/aryes_data?select=key,value`, {
      headers: { 'apikey': SKEY, 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) return;
    const rows = await r.json();
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      try {
        const val = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        localStorage.setItem(row.key, val);
      } catch { /* ignore quota errors */ }
    });
    localStorage.setItem('aryes-last-sync', new Date().toISOString());
  } catch { /* never throw */ }
}

// ─── LS — localStorage with async Supabase backup ────────────────────────────
// Primary store: localStorage (instant reads/writes).
// Secondary store: aryes_data table in Supabase (async, non-blocking).
// Strategy: write localStorage first, fire Supabase write in background.
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
      sbWrite(key, value); // async fire-and-forget
    } catch { /* never block */ }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      fetch(`${SB_URL}/rest/v1/aryes_data?key=eq.${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch(() => {});
    } catch { /* never block */ }
  },
};

// ─── db — typed Supabase REST client ─────────────────────────────────────────
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
  // Prevents stale-read stock overwrites in concurrent operations.
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
      if (rows.length > 0) return rows[0]; // success

      // 0 rows updated: concurrent write beat us — refetch and retry
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

// ─── Alert config ─────────────────────────────────────────────────────────────
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

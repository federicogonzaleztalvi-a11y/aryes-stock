// ─── Facturación — shared constants, helpers ─────────────────────────────────
// Used by: FacturacionTab, ItemSearchRow, ItemsTable, ModalFactura, components.jsx

// ─── Tokens ───────────────────────────────────────────────────────────────
export const G  = '#1a8a3c';
export const F  = {
  sans:  "'DM Sans', system-ui, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono:  "'DM Mono', 'Fira Code', monospace",
};

// ─── Constants ────────────────────────────────────────────────────────────
export const COND_PAGO = [
  { value: 'contado',    label: 'Contado',         dias: 0  },
  { value: 'credito_15', label: 'Crédito 15 días',  dias: 15 },
  { value: 'credito_30', label: 'Crédito 30 días',  dias: 30 },
  { value: 'credito_60', label: 'Crédito 60 días',  dias: 60 },
  { value: 'credito_90', label: 'Crédito 90 días',  dias: 90 },
];

export const CFE_TIPOS = {
  'e-Factura': { icon: '🧾', code: 'eFact' },
  'e-Ticket':  { icon: '🎫', code: 'eTick' },
  'e-Remito':  { icon: '📦', code: 'eRem'  },
  'e-N.Créd.': { icon: '↩',  code: 'eNC'   },
};

export const CFE_STATUS = {
  borrador:  { label: 'Borrador',  color: '#6a6a68', bg: '#f0f0ec' },
  pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fffbeb' },
  emitida:   { label: 'Emitida',   color: '#2563eb', bg: '#eff6ff' },
  aceptada:  { label: 'Aceptada',  color: '#16a34a', bg: '#f0fdf4' },
  rechazada: { label: 'Rechazada', color: '#dc2626', bg: '#fef2f2' },
  anulada:   { label: 'Anulada',   color: '#9a9a98', bg: '#f9f9f7' },
  cobrada:   { label: 'Cobrada',   color: '#16a34a', bg: '#f0fdf4' },
};

export const IVA_RATES = [22, 10, 0];
export const MONEDAS   = ['UYU', 'USD', 'EUR'];

// ─── Helpers ──────────────────────────────────────────────────────────────
export const newId     = () => crypto.randomUUID();
export const today     = () => new Date().toISOString().split('T')[0];
export const addDays   = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
export const daysUntil = d => d ? Math.floor((new Date(d).getTime() - Date.now()) / 86400000) : null;



export const fmtDateShort = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';

export const agingBucket = dias => {
  if (dias <= 0)  return { label: 'Al día',   color: '#16a34a', bg: '#f0fdf4', pri: 0 };
  if (dias <= 30) return { label: '1-30d',     color: '#d97706', bg: '#fffbeb', pri: 1 };
  if (dias <= 60) return { label: '31-60d',    color: '#ea580c', bg: '#fff7ed', pri: 2 };
  if (dias <= 90) return { label: '61-90d',    color: '#dc2626', bg: '#fef2f2', pri: 3 };
  return             { label: '+90d',      color: '#7c3aed', bg: '#f5f3ff', pri: 4 };
};

export function fmtMoney(n, currency = 'USD') {
  if (n == null || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

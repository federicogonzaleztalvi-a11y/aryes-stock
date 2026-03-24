// ─── Facturación — shared constants, helpers, micro-components ──────────────
// Used by: FacturacionTab, ItemSearchRow, ItemsTable, ModalFactura
import React from 'react';

// ─── Tokens ───────────────────────────────────────────────────────────────
export const G  = '#3a7d1e';
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

export const fmtMoney = (n, cur='UYU') => {
  const sym = cur==='UYU'?'$':cur==='USD'?'US$':'€';
  return `${sym} ${Number(n||0).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
};

export const fmtDateShort = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';

export const agingBucket = dias => {
  if (dias <= 0)  return { label: 'Al día',   color: '#16a34a', bg: '#f0fdf4', pri: 0 };
  if (dias <= 30) return { label: '1-30d',     color: '#d97706', bg: '#fffbeb', pri: 1 };
  if (dias <= 60) return { label: '31-60d',    color: '#ea580c', bg: '#fff7ed', pri: 2 };
  if (dias <= 90) return { label: '61-90d',    color: '#dc2626', bg: '#fef2f2', pri: 3 };
  return             { label: '+90d',      color: '#7c3aed', bg: '#f5f3ff', pri: 4 };
};

// ─── Micro-components ─────────────────────────────────────────────────────
export const Pill = ({ status }) => {
  const s = CFE_STATUS[status] || CFE_STATUS.borrador;
  return (
    <span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,
      background:s.bg,color:s.color,fontFamily:F.sans,letterSpacing:'.02em'}}>
      {s.label}
    </span>
  );
};

export const TabBtn = ({ active, onClick, children }) =>
  <button onClick={onClick} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',
    fontFamily:F.sans,fontSize:12,fontWeight:600,
    background:active?G:'transparent',color:active?'#fff':'#6a6a68',
    transition:'all .15s'}}>
    {children}
  </button>;

export const Lbl = ({ children }) =>
  <label style={{fontFamily:F.sans,fontSize:11,fontWeight:600,color:'#6a6a68',letterSpacing:'.06em',
    textTransform:'uppercase',display:'block',marginBottom:4}}>
    {children}
  </label>;

export const Inp = ({ style={}, ...p }) =>
  <input {...p} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e2de',borderRadius:6,
    fontFamily:F.sans,fontSize:13,outline:'none',background:'#fff',boxSizing:'border-box',...style}} />;

export const Sel = ({ children, style={}, ...p }) =>
  <select {...p} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e2de',borderRadius:6,
    fontFamily:F.sans,fontSize:13,outline:'none',background:'#fff',boxSizing:'border-box',...style}}>
    {children}
  </select>;

export const KpiCard = ({ label, value, sub, accent='#e2e2de', danger=false, onClick }) =>
  <div onClick={onClick} style={{background:'#fff',border:`1px solid ${accent}`,borderRadius:10,
    padding:'14px 18px',cursor:onClick?'pointer':'default',
    borderLeft:`4px solid ${danger?'#dc2626':accent}`}}>
    <div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',fontWeight:600,letterSpacing:'.06em',
      textTransform:'uppercase',marginBottom:6}}>{label}</div>
    <div style={{fontFamily:F.serif,fontSize:24,fontWeight:500,color:danger?'#dc2626':'#1a1a1a',
      lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',marginTop:4}}>{sub}</div>}
  </div>;

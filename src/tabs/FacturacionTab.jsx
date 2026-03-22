import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LS, db } from '../lib/constants.js';

// ── Design tokens (local, coherent with app T) ─────────────────────────────
const G = '#3a7d1e';
const F = {
  sans:   "'DM Sans', 'Inter', system-ui, sans-serif",
  serif:  "'Playfair Display', Georgia, serif",
  mono:   "'DM Mono', 'Fira Code', monospace",
};

// CFE status config
const CFE_STATUS = {
  borrador:  { label: 'Borrador',   color: '#6a6a68', bg: '#f0f0ec', dot: '#9a9a98' },
  pendiente: { label: 'Pendiente',  color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  emitida:   { label: 'Emitida',    color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  aceptada:  { label: 'Aceptada',   color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  rechazada: { label: 'Rechazada',  color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  anulada:   { label: 'Anulada',    color: '#9a9a98', bg: '#f9f9f7', dot: '#d1d5db' },
};

// CFE types
const CFE_TIPOS = {
  'e-Factura':      { code: 'eFact',   icon: '🧾', desc: 'Factura electrónica a empresa' },
  'e-Ticket':       { code: 'eTick',   icon: '🎫', desc: 'Ticket electrónico consumidor final' },
  'e-Remito':       { code: 'eRem',    icon: '📦', desc: 'Remito de traslado de mercadería' },
  'e-Nota Crédito': { code: 'eNC',     icon: '↩',  desc: 'Nota de crédito electrónica' },
  'e-Nota Débito':  { code: 'eND',     icon: '↗',  desc: 'Nota de débito electrónica' },
};

const IVA_RATES = [
  { label: 'IVA 22%', value: 22 },
  { label: 'IVA 10%', value: 10 },
  { label: 'Exento 0%', value: 0 },
];

const MONEDAS = ['UYU', 'USD', 'EUR'];

const fmtMoney = (n, cur = 'UYU') => {
  const sym = cur === 'UYU' ? '$' : cur === 'USD' ? 'US$' : '€';
  return `${sym} ${Number(n || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];
const newId = () => 'cfe-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

// ── Subcomponents ──────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const s = CFE_STATUS[status] || CFE_STATUS.borrador;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: s.bg, color: s.color,
      fontFamily: F.sans, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px',
      borderTop: `3px solid ${accent || '#e2e2de'}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .15s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: F.serif, fontSize: 34, fontWeight: 400, color: '#1a1a18', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 40px' }}>
      <div style={{ fontSize: 56, marginBottom: 16, opacity: .6 }}>🧾</div>
      <div style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 400, color: '#1a1a18', marginBottom: 8 }}>Sin comprobantes aún</div>
      <div style={{ fontFamily: F.sans, fontSize: 14, color: '#9a9a98', marginBottom: 28, maxWidth: 360, margin: '0 auto 28px' }}>
        Emití tu primer CFE electrónico. Facturas, tickets, remitos y notas de crédito — todo desde acá.
      </div>
      <button onClick={onNew} style={{
        background: G, color: '#fff', border: 'none', borderRadius: 10,
        padding: '12px 28px', fontFamily: F.sans, fontSize: 14, fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>+</span> Nuevo CFE
      </button>
    </div>
  );
}

// ── New CFE Wizard (3 steps) ───────────────────────────────────────────────
function NuevoCFEWizard({ clientes, productos, onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    tipo: 'e-Factura',
    moneda: 'UYU',
    fecha: today(),
    fechaVenc: '',
    clienteId: '',
    clienteNombre: '',
    clienteRut: '',
    clienteDir: '',
    items: [],
    notas: '',
    descuento: 0,
  });
  const [itemForm, setItemForm] = useState({ prodId: '', desc: '', cant: 1, precio: 0, iva: 22 });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setItem = (k, v) => setItemForm(p => ({ ...p, [k]: v }));

  const subtotal = form.items.reduce((s, it) => s + it.cant * it.precio, 0);
  const descMonto = subtotal * (form.descuento / 100);
  const base = subtotal - descMonto;
  const ivaTotal = form.items.reduce((s, it) => s + (it.cant * it.precio * (1 - form.descuento / 100)) * (it.iva / 100), 0);
  const total = base + ivaTotal;

  const addItem = () => {
    if (!itemForm.desc || !itemForm.cant || !itemForm.precio) return;
    set('items', [...form.items, { ...itemForm, id: newId() }]);
    setItemForm({ prodId: '', desc: '', cant: 1, precio: 0, iva: 22 });
  };

  const removeItem = id => set('items', form.items.filter(i => i.id !== id));

  const handleProdSelect = id => {
    const p = productos.find(x => x.id === id);
    if (!p) return;
    setItemForm(f => ({ ...f, prodId: id, desc: p.name, precio: p.unitCost || 0 }));
  };

  const handleClienteSelect = id => {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    set('clienteId', id);
    set('clienteNombre', c.nombre || c.name || '');
    set('clienteRut', c.rut || '');
    set('clienteDir', c.direccion || '');
  };

  const canNext1 = form.tipo && form.fecha;
  const canNext2 = form.clienteNombre;
  const canSave = form.items.length > 0;

  const stepLabel = ['Tipo y fecha', 'Receptor', 'Líneas'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,8,.5)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: 680, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.18)' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid #e2e2de', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 4 }}>Nuevo comprobante fiscal electrónico</div>
            <div style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400, color: '#1a1a18' }}>Paso {step} — {stepLabel[step - 1]}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f0f0ec', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6a6a68' }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#f0f0ec', flexShrink: 0 }}>
          <div style={{ height: '100%', background: G, width: `${(step / 3) * 100}%`, transition: 'width .3s ease' }} />
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, padding: '0 32px', borderBottom: '1px solid #f0f0ec', flexShrink: 0 }}>
          {stepLabel.map((l, i) => (
            <div key={l} style={{ flex: 1, padding: '14px 0', textAlign: 'center', fontFamily: F.sans, fontSize: 12, fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? G : i + 1 < step ? '#9a9a98' : '#c8c8c4', borderBottom: i + 1 === step ? `2px solid ${G}` : '2px solid transparent', transition: 'all .2s', cursor: i + 1 < step ? 'pointer' : 'default' }}
              onClick={() => { if (i + 1 < step) setStep(i + 1); }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: i + 1 < step ? G : i + 1 === step ? G : '#e2e2de', color: i + 1 <= step ? '#fff' : '#9a9a98', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1 < step ? '✓' : i + 1}</span>
                {l}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* Step 1 — Tipo y fecha */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 8 }}>Tipo de CFE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(CFE_TIPOS).map(([tipo, cfg]) => (
                    <button key={tipo} onClick={() => set('tipo', tipo)} style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: 10,
                      border: `2px solid ${form.tipo === tipo ? G : '#e2e2de'}`,
                      background: form.tipo === tipo ? '#f0f7ec' : '#fff',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{cfg.icon}</span>
                      <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: form.tipo === tipo ? G : '#1a1a18', display: 'block' }}>{tipo}</span>
                      <span style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', display: 'block', marginTop: 2 }}>{cfg.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Fecha emisión</label>
                  <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Vencimiento</label>
                  <input type="date" value={form.fechaVenc} onChange={e => set('fechaVenc', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Moneda</label>
                  <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none', background: '#fff' }}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Receptor */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              {clientes.length > 0 && (
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Seleccionar cliente existente</label>
                  <select value={form.clienteId} onChange={e => handleClienteSelect(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none', background: '#fff' }}>
                    <option value="">— Seleccionar —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Razón social / Nombre *</label>
                  <input value={form.clienteNombre} onChange={e => set('clienteNombre', e.target.value)} placeholder="Empresa S.A. o Juan Pérez" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1.5px solid ${form.clienteNombre ? G : '#e2e2de'}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>RUT</label>
                  <input value={form.clienteRut} onChange={e => set('clienteRut', e.target.value)} placeholder="21XXXXXXXXXXXXXXX" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none', fontFamily: F.mono }} />
                </div>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Dirección</label>
                  <input value={form.clienteDir} onChange={e => set('clienteDir', e.target.value)} placeholder="Av. 18 de Julio 1234" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none' }} />
                </div>
              </div>

              {(form.tipo === 'e-Ticket') && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px' }}>
                  <span style={{ fontFamily: F.sans, fontSize: 12, color: '#92400e' }}>💡 El e-Ticket no requiere RUT del receptor — es para consumidor final.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Líneas */}
          {step === 3 && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Add item row */}
              <div style={{ background: '#f9f9f7', borderRadius: 10, padding: 16, border: '1px solid #e2e2de' }}>
                <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 12 }}>Agregar línea</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', display: 'block', marginBottom: 4 }}>Descripción</label>
                    {productos.length > 0
                      ? <select value={itemForm.prodId} onChange={e => { handleProdSelect(e.target.value); }} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.sans, fontSize: 13, background: '#fff', outline: 'none', color: '#1a1a18' }}>
                          <option value="">— Producto —</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      : <input value={itemForm.desc} onChange={e => setItem('desc', e.target.value)} placeholder="Descripción del ítem" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.sans, fontSize: 13, outline: 'none' }} />
                    }
                  </div>
                  <div>
                    <label style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', display: 'block', marginBottom: 4 }}>Cantidad</label>
                    <input type="number" min="0.001" step="0.001" value={itemForm.cant} onChange={e => setItem('cant', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.mono, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                  </div>
                  <div>
                    <label style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', display: 'block', marginBottom: 4 }}>Precio unit.</label>
                    <input type="number" min="0" step="0.01" value={itemForm.precio} onChange={e => setItem('precio', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.mono, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                  </div>
                  <div>
                    <label style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', display: 'block', marginBottom: 4 }}>IVA</label>
                    <select value={itemForm.iva} onChange={e => setItem('iva', Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.sans, fontSize: 12, background: '#fff', outline: 'none', color: '#1a1a18' }}>
                      {IVA_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <button onClick={addItem} style={{ background: G, color: '#fff', border: 'none', borderRadius: 7, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>

              {/* Items table */}
              {form.items.length > 0 ? (
                <div style={{ border: '1px solid #e2e2de', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9f9f7', borderBottom: '1px solid #e2e2de' }}>
                        {['Descripción', 'Cant.', 'Precio', 'IVA', 'Total', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h === '' ? 'center' : 'left', fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a98' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, i) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid #f0f0ec', background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>{it.desc}</td>
                          <td style={{ padding: '10px 14px', fontFamily: F.mono, textAlign: 'right' }}>{it.cant}</td>
                          <td style={{ padding: '10px 14px', fontFamily: F.mono, textAlign: 'right' }}>{fmtMoney(it.precio, form.moneda)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6a6a68' }}>{it.iva}%</td>
                          <td style={{ padding: '10px 14px', fontFamily: F.mono, fontWeight: 700, textAlign: 'right' }}>{fmtMoney(it.cant * it.precio * (1 + it.iva / 100), form.moneda)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9a9a98', fontFamily: F.sans, fontSize: 13, border: '1.5px dashed #e2e2de', borderRadius: 10 }}>
                  Agregá al menos una línea para continuar
                </div>
              )}

              {/* Totals + notas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 20 }}>
                <div>
                  <label style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', display: 'block', marginBottom: 6 }}>Notas</label>
                  <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} placeholder="Condición de pago, referencias, instrucciones..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: '#1a1a18', outline: 'none', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  {[
                    { label: 'Subtotal', val: fmtMoney(subtotal, form.moneda) },
                    { label: `Descuento ${form.descuento}%`, val: `-${fmtMoney(descMonto, form.moneda)}`, hide: !form.descuento },
                    { label: 'IVA', val: fmtMoney(ivaTotal, form.moneda), muted: true },
                  ].filter(r => !r.hide).map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.sans, fontSize: 12, color: r.muted ? '#9a9a98' : '#3a3a38' }}>
                      <span>{r.label}</span><span style={{ fontFamily: F.mono }}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '2px solid #1a1a18', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>TOTAL</span>
                    <span style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 400, color: G }}>{fmtMoney(total, form.moneda)}</span>
                  </div>
                  <div>
                    <label style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', display: 'block', marginBottom: 4 }}>Descuento global %</label>
                    <input type="number" min="0" max="100" value={form.descuento} onChange={e => set('descuento', Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1.5px solid #e2e2de', borderRadius: 7, fontFamily: F.mono, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px 24px', borderTop: '1px solid #f0f0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} style={{ background: '#f0f0ec', color: '#3a3a38', border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 3 && (
              <button onClick={() => onSave({ ...form, status: 'borrador', subtotal, ivaTotal, total })} style={{ background: '#f0f0ec', color: '#3a3a38', border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Guardar borrador
              </button>
            )}
            {step < 3
              ? <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNext1 : !canNext2} style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (step === 1 ? !canNext1 : !canNext2) ? .4 : 1 }}>
                Siguiente →
              </button>
              : <button onClick={() => onSave({ ...form, status: 'pendiente', subtotal, ivaTotal, total })} disabled={!canSave} style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !canSave ? .4 : 1 }}>
                Emitir CFE →
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CFE Detail Panel ───────────────────────────────────────────────────────
function CFEDetail({ cfe, onClose, onAnular, onReenviar }) {
  const s = CFE_STATUS[cfe.status] || CFE_STATUS.borrador;
  const subtotal = cfe.items?.reduce((s, it) => s + it.cant * it.precio, 0) || 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(10,10,8,.4)' }} onClick={onClose}>
      <div style={{ width: 520, height: '100%', background: '#fff', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,.12)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #f0f0ec' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 6 }}>
                {CFE_TIPOS[cfe.tipo]?.icon} {cfe.tipo}
              </div>
              <div style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 400, color: '#1a1a18', lineHeight: 1 }}>
                {cfe.numero || 'SIN NÚMERO'}
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#f0f0ec', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6a6a68' }}>✕</button>
          </div>
          <StatusPill status={cfe.status} />
        </div>

        {/* Amount hero */}
        <div style={{ padding: '24px 32px', background: '#f9f9f7', borderBottom: '1px solid #f0f0ec' }}>
          <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 6 }}>Total</div>
          <div style={{ fontFamily: F.serif, fontSize: 42, fontWeight: 400, color: G, lineHeight: 1 }}>{fmtMoney(cfe.total, cfe.moneda)}</div>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: '#9a9a98', marginTop: 6 }}>IVA incluido · {cfe.moneda}</div>
        </div>

        {/* Details */}
        <div style={{ padding: '24px 32px' }}>

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 8 }}>Emisor</div>
              <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>Aryes</div>
            </div>
            <div>
              <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 8 }}>Receptor</div>
              <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{cfe.clienteNombre || '—'}</div>
              {cfe.clienteRut && <div style={{ fontFamily: F.mono, fontSize: 11, color: '#6a6a68', marginTop: 2 }}>RUT {cfe.clienteRut}</div>}
              {cfe.clienteDir && <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 2 }}>{cfe.clienteDir}</div>}
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[['Fecha de emisión', fmtDate(cfe.fecha)], ['Vencimiento', fmtDate(cfe.fechaVenc)]].map(([l, v]) => (
              <div key={l} style={{ background: '#f9f9f7', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 4 }}>{l}</div>
                <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          {cfe.items?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 10 }}>Líneas</div>
              <div style={{ border: '1px solid #e2e2de', borderRadius: 8, overflow: 'hidden' }}>
                {cfe.items.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? '#fff' : '#fafaf8', borderBottom: i < cfe.items.length - 1 ? '1px solid #f0f0ec' : 'none' }}>
                    <div>
                      <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{it.desc}</div>
                      <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 2 }}>{it.cant} × {fmtMoney(it.precio, cfe.moneda)} · IVA {it.iva}%</div>
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>{fmtMoney(it.cant * it.precio * (1 + it.iva / 100), cfe.moneda)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div style={{ background: '#f9f9f7', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
            {[
              ['Subtotal', fmtMoney(cfe.subtotal, cfe.moneda)],
              ['IVA', fmtMoney(cfe.ivaTotal, cfe.moneda)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.sans, fontSize: 12, color: '#6a6a68', marginBottom: 6 }}>
                <span>{l}</span><span style={{ fontFamily: F.mono }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e2de', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>TOTAL</span>
              <span style={{ fontFamily: F.serif, fontSize: 20, color: G }}>{fmtMoney(cfe.total, cfe.moneda)}</span>
            </div>
          </div>

          {cfe.notas && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 24 }}>
              <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#92400e', marginBottom: 4 }}>Notas</div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: '#92400e' }}>{cfe.notas}</div>
            </div>
          )}

          {/* Integration notice */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontFamily: F.sans, fontSize: 12, color: '#1e40af', fontWeight: 600, marginBottom: 2 }}>🔗 Integración con proveedor DGI pendiente</div>
            <div style={{ fontFamily: F.sans, fontSize: 11, color: '#3b82f6' }}>Este CFE será enviado automáticamente a DGI cuando se configure el proveedor habilitado (UCFE/pymo).</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cfe.status !== 'anulada' && cfe.status !== 'rechazada' && (
              <button onClick={() => onAnular(cfe.id)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1.5px solid #fecaca', borderRadius: 8, fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>
                Anular CFE
              </button>
            )}
            <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#f0f0ec', border: 'none', borderRadius: 8, fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: '#3a3a38', cursor: 'pointer' }}>
              🖨 Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
function FacturacionTab({ products = [], clientes: clientesProp = [] }) {
  const KFACT = 'aryes-cfe';
  const [cfes, setCfes] = useState(() => LS.get(KFACT, []));
  const [clientes, setClientes] = useState(() => {
    const c = LS.get('aryes-clients', []);
    return clientesProp.length > 0 ? clientesProp : c;
  });

  const [showWizard, setShowWizard] = useState(false);
  const [selectedCfe, setSelectedCfe] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [numActual, setNumActual] = useState(() => LS.get('aryes-cfe-seq', 1));

  const save = (arr) => { setCfes(arr); LS.set(KFACT, arr); };

  const handleSave = (form) => {
    const seq = numActual;
    const prefix = CFE_TIPOS[form.tipo]?.code || 'CFE';
    const numero = `${prefix}-${String(seq).padStart(6, '0')}`;
    const nuevo = { ...form, id: newId(), numero, createdAt: new Date().toISOString() };
    save([nuevo, ...cfes]);
    setNumActual(seq + 1);
    LS.set('aryes-cfe-seq', seq + 1);
    setShowWizard(false);
  };

  const handleAnular = (id) => {
    if (!window.confirm('¿Anular este CFE? Esta acción no se puede deshacer.')) return;
    save(cfes.map(c => c.id === id ? { ...c, status: 'anulada' } : c));
    setSelectedCfe(null);
  };

  const filtered = useMemo(() => cfes.filter(c => {
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (c.numero || '').toLowerCase().includes(q) || (c.clienteNombre || '').toLowerCase().includes(q);
    }
    return true;
  }), [cfes, filtroStatus, filtroTipo, busqueda]);

  // KPIs
  const totalEmitido = cfes.filter(c => ['emitida', 'aceptada'].includes(c.status)).reduce((s, c) => s + (c.total || 0), 0);
  const pendienteCobro = cfes.filter(c => c.status === 'emitida').reduce((s, c) => s + (c.total || 0), 0);
  const esteMes = cfes.filter(c => {
    const d = new Date(c.createdAt || c.fecha);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="au" style={{ display: 'grid', gap: 28, maxWidth: 1200 }}>
      {/* Google Fonts */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@400;500&display=swap" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9a98', marginBottom: 6 }}>Facturación electrónica · CFE Uruguay</div>
          <h1 style={{ fontFamily: F.serif, fontSize: 38, fontWeight: 400, color: '#1a1a18', margin: 0, letterSpacing: '-.02em', lineHeight: 1 }}>Comprobantes</h1>
        </div>
        <button onClick={() => setShowWizard(true)} style={{
          background: G, color: '#fff', border: 'none', borderRadius: 10,
          padding: '12px 24px', fontFamily: F.sans, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 8px rgba(58,125,30,.3)', transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(58,125,30,.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(58,125,30,.3)'; }}>
          <span style={{ fontSize: 18 }}>+</span> Nuevo CFE
        </button>
      </div>

      {/* Integration banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🔗</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: '#1e40af' }}>Proveedor habilitado DGI no configurado — </span>
          <span style={{ fontFamily: F.sans, fontSize: 13, color: '#3b82f6' }}>Los CFEs se guardan localmente. Cuando conectes UCFE o pymo, se enviarán automáticamente a DGI.</span>
        </div>
        <span style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#dbeafe', padding: '4px 10px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap' }}>Configurar →</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#e2e2de', borderRadius: 12, overflow: 'hidden' }}>
        <KpiCard label="Total emitido" value={totalEmitido > 0 ? `$${(totalEmitido / 1000).toFixed(1)}k` : '—'} sub="CFEs emitidas y aceptadas" accent={G} />
        <KpiCard label="Pendiente cobro" value={pendienteCobro > 0 ? `$${(pendienteCobro / 1000).toFixed(1)}k` : '—'} sub="CFEs emitidas sin confirmar" accent={pendienteCobro > 0 ? '#d97706' : '#e2e2de'} />
        <KpiCard label="Este mes" value={esteMes} sub="comprobantes emitidos" accent={esteMes > 0 ? '#2563eb' : '#e2e2de'} />
        <KpiCard label="Total CFEs" value={cfes.length} sub={`${cfes.filter(c => c.status === 'aceptada').length} aceptados por DGI`} accent="#e2e2de" />
      </div>

      {/* Filters */}
      {cfes.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por número o cliente..." style={{ flex: 1, minWidth: 220, padding: '8px 14px 8px 36px', border: '1.5px solid #e2e2de', borderRadius: 8, fontFamily: F.sans, fontSize: 13, outline: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a9a98' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: '12px center' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos', ...Object.keys(CFE_STATUS)].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)} style={{ padding: '7px 14px', borderRadius: 20, fontFamily: F.sans, fontSize: 12, fontWeight: filtroStatus === s ? 700 : 500, cursor: 'pointer', border: `1.5px solid ${filtroStatus === s ? G : '#e2e2de'}`, background: filtroStatus === s ? '#f0f7ec' : '#fff', color: filtroStatus === s ? G : '#6a6a68', transition: 'all .15s' }}>
                {s === 'todos' ? 'Todos' : CFE_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {cfes.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e2de' }}>
          <EmptyState onNew={() => setShowWizard(true)} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#f9f9f7', borderRadius: 12, padding: '40px', textAlign: 'center', color: '#9a9a98', fontFamily: F.sans, fontSize: 13 }}>
          Sin resultados para los filtros seleccionados
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e2de', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px 120px 80px', gap: 0, padding: '10px 20px', borderBottom: '1px solid #f0f0ec', background: '#f9f9f7' }}>
            {['Número', 'Tipo', 'Receptor', 'Fecha', 'Total', 'Estado'].map(h => (
              <div key={h} style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((cfe, i) => (
            <div key={cfe.id} onClick={() => setSelectedCfe(cfe)} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px 120px 80px',
              gap: 0, padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #f0f0ec' : 'none',
              background: i % 2 === 0 ? '#fff' : '#fafaf8',
              cursor: 'pointer', transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ec'}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafaf8'}>
              <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: '#1a1a18', display: 'flex', alignItems: 'center' }}>{cfe.numero || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.sans, fontSize: 13 }}>
                <span>{CFE_TIPOS[cfe.tipo]?.icon}</span>
                <span style={{ color: '#3a3a38' }}>{cfe.tipo}</span>
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: '#1a1a18', fontWeight: 500, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfe.clienteNombre || '—'}</div>
              <div style={{ fontFamily: F.sans, fontSize: 12, color: '#9a9a98', display: 'flex', alignItems: 'center' }}>{fmtDate(cfe.fecha)}</div>
              <div style={{ fontFamily: F.serif, fontSize: 16, color: G, display: 'flex', alignItems: 'center' }}>{fmtMoney(cfe.total, cfe.moneda)}</div>
              <div style={{ display: 'flex', alignItems: 'center' }}><StatusPill status={cfe.status} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <NuevoCFEWizard
          clientes={clientes}
          productos={products}
          onSave={handleSave}
          onClose={() => setShowWizard(false)}
        />
      )}

      {selectedCfe && (
        <CFEDetail
          cfe={selectedCfe}
          onClose={() => setSelectedCfe(null)}
          onAnular={handleAnular}
          onReenviar={() => {}}
        />
      )}
    </div>
  );
}

export default FacturacionTab;

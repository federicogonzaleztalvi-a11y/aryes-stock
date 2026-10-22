// src/components/SalesInsights.jsx — Inteligencia de clientes (panel interactivo).
// ----------------------------------------------------------------------------
// Capa 1 del módulo de fichas: sube el informe "Movimiento de productos" (ERP
// Mercado) desde el navegador, lo normaliza y lo manda a /api/sales-import en
// tandas; después lee /api/sales-analytics?action=overview y pinta el ranking
// ABC de la cartera + KPIs (crece / decrece / dejó de comprar / nuevos) + ventas
// mensuales (12m vs 12m anteriores) + ventas por familia.
//
// El informe real de Mercado es un HTML renombrado a .xls, con ~18.700 líneas,
// números en formato "N,000000" (coma decimal) que SheetJS malinterpreta como
// miles → quedan multiplicados por 1.000.000; corregimos dividiendo (igual que
// el script Python original). Las ventas figuran con cantidad NEGATIVA.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getAuthHeaders } from '../lib/constants.js';

const G = '#3a7d1e';
const CHUNK = 2500;                       // filas por tanda (server tope 3000)
const CLASE_COLOR = { A: '#059669', B: '#d97706', C: '#9ca3af' };

const two = (v) => String(v).padStart(2, '0');
const fmtMoney = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY');
const fmtMes = (ym) => {
  const [, m] = ym.split('-');
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1] || ym;
};

// ── parse del informe Mercado (todo client-side) ──
function dateYMD(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + two(v.getMonth() + 1) + '-' + two(v.getDate());
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return m[1] + '-' + two(m[2]) + '-' + two(m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + two(m[2]) + '-' + two(m[1]); }
  return null;
}
function parseNum(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
function median(arr) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}
function parseInforme(arrayBuffer) {
  // El HTML de Mercado viene en Windows-1252; decodificamos a texto para no
  // romper los acentos de las razones sociales (claves del ranking).
  const str = new TextDecoder('windows-1252').decode(arrayBuffer);
  const wb = XLSX.read(str, { type: 'string', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let hdr = aoa.findIndex((r, i) => i < 15 && typeof r[0] === 'string' && r[0].trim().toLowerCase().startsWith('fecha'));
  if (hdr < 0) hdr = 3;
  const body = aoa.slice(hdr + 1);

  // Corrección x1.000.000: si la mediana de códigos/cantidades está inflada.
  const cants = [], cods = [];
  for (const r of body) {
    const c = parseNum(r[4]), cd = parseNum(r[7]);
    if (Number.isFinite(c)) cants.push(Math.abs(c));
    if (Number.isFinite(cd)) cods.push(Math.abs(cd));
  }
  const fix = median(cods) > 1e6 || median(cants) > 1e4;

  const rows = [];
  for (const r of body) {
    const fecha = dateYMD(r[0]);
    const rs = String(r[1] || '').trim();
    const producto = String(r[3] || '').trim();
    if (!fecha || !rs || !producto) continue;
    let cant = parseNum(r[4]), imp = parseNum(r[5]);
    if (!Number.isFinite(cant)) cant = 0;
    if (!Number.isFinite(imp)) imp = 0;
    if (fix) { cant /= 1e6; imp /= 1e6; }
    rows.push({
      fecha,
      rs,
      nombre: String(r[2] || '').trim(),
      producto,
      familia: String(r[6] || '').trim(),
      cantidad: -cant,                         // en Mercado la venta es negativa
      importe: imp,
      codigo: r[7] != null && r[7] !== '' ? String(Math.round(parseNum(r[7]) / (fix ? 1e6 : 1))) : '',
    });
  }
  return rows;
}

export default function SalesInsights({ isAdmin }) {
  const [status, setStatus] = useState(undefined);   // undefined=cargando, null=sin datos, obj=con datos
  const [overview, setOverview] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState('');
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [filtroClase, setFiltroClase] = useState('');
  const fileRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/sales-analytics?action=status', { headers: getAuthHeaders() });
      if (!r.ok) { setStatus(null); return; }
      const d = await r.json();
      setStatus(d.lines > 0 ? d : null);
    } catch { setStatus(null); }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const r = await fetch('/api/sales-analytics?action=overview', { headers: getAuthHeaders() });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.empty) setOverview(d);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status && status.lines > 0 && open && !overview) loadOverview(); }, [status, open, overview, loadOverview]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (file) { if (fileRef.current) fileRef.current.value = ''; }
    if (!file) return;
    setErr(''); setBusy(true); setProg('Leyendo archivo…');
    try {
      const buf = await file.arrayBuffer();
      const rows = parseInforme(buf);
      if (!rows.length) throw new Error('No se encontraron líneas de ventas en el archivo.');

      const batchId = (crypto.randomUUID && crypto.randomUUID()) ||
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

      const total = rows.length;
      let sent = 0;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= total;
        setProg(`Subiendo ${Math.min(i + chunk.length, total).toLocaleString('es-UY')} de ${total.toLocaleString('es-UY')} líneas…`);
        const r = await fetch('/api/sales-import', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            batch_id: batchId,
            rows: chunk.map((x) => ({
              fecha: x.fecha, rs: x.rs, nombre: x.nombre, producto: x.producto,
              familia: x.familia, cantidad: x.cantidad, importe: x.importe, codigo: x.codigo,
            })),
            commit: isLast,
          }),
        });
        if (!r.ok) {
          const t = await r.json().catch(() => ({}));
          throw new Error(t.error || `Error al subir (${r.status})`);
        }
        const d = await r.json();
        sent += d.inserted || 0;
      }
      setProg('Procesando…');
      setOverview(null);
      await loadStatus();
      await loadOverview();
      setOpen(true);
      setProg(`Listo: ${sent.toLocaleString('es-UY')} líneas importadas.`);
      setTimeout(() => setProg(''), 4000);
    } catch (e2) {
      setErr(e2.message || 'No se pudo importar el informe.');
      setProg('');
    } finally {
      setBusy(false);
    }
  }

  if (status === undefined) return null;   // primer render, sin parpadeo

  const kpi = overview?.kpi;
  const ranking = overview?.ranking || [];
  const rankFiltered = filtroClase ? ranking.filter((x) => x.clase === filtroClase) : ranking;
  const rankShown = showAll ? rankFiltered : rankFiltered.slice(0, 12);
  const maxMes = overview ? Math.max(1, ...overview.meses.map((m) => Math.max(overview.mesActual[m] || 0, overview.mesPrev[m] || 0))) : 1;

  const card = (label, value, color, sub) => (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #f0f0ef' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9a9a98', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
            Inteligencia de clientes
            {status
              ? <span style={{ marginLeft: 8, fontSize: 11, color: '#9a9a98' }}>{status.clientes} clientes · {status.lines.toLocaleString('es-UY')} líneas</span>
              : <span style={{ marginLeft: 8, fontSize: 11, color: '#9a9a98' }}>sin datos cargados</span>}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
        </button>
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".xls,.xlsx,.htm,.html" onChange={onFile} style={{ display: 'none' }} />
            <button disabled={busy} onClick={() => fileRef.current?.click()}
              style={{ background: status ? '#fff' : G, color: status ? G : '#fff', border: `1px solid ${G}`, padding: '7px 14px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
              {busy ? '⏳ Importando…' : status ? '↻ Actualizar informe' : '↑ Importar informe Mercado'}
            </button>
          </>
        )}
      </div>

      {prog && <div style={{ marginTop: 12, fontSize: 12, color: G }}>{prog}</div>}
      {err && <div style={{ marginTop: 12, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}

      {open && !status && !busy && (
        <div style={{ marginTop: 16, textAlign: 'center', padding: '28px 20px', color: '#6b7280', fontSize: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Todavía no hay datos de ventas</div>
          Importá el informe <b>“Movimiento de productos”</b> que bajás de tu ERP (2 años de historia).<br />
          Te arma el ranking ABC de la cartera, quién crece, quién dejó de comprar y las ventas mes a mes.
        </div>
      )}

      {open && status && overview && (
        <div style={{ marginTop: 18 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
            {card('Clientes activos (12m)', overview.totalClientes - kpi.perdidos, '#374151', `${overview.totalClientes} en total`)}
            {card('Creciendo', kpi.crecen, '#059669', '+10% vs año anterior')}
            {card('Decreciendo', kpi.decrecen, '#d97706', '−10% vs año anterior')}
            {card('Dejaron de comprar', kpi.perdidos, '#dc2626', 'compraban y pararon')}
            {card('Nuevos', kpi.nuevos, G, 'empezaron este período')}
          </div>

          {/* Ventas 12m vs 12m anteriores */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9a9a98', fontWeight: 600 }}>VENTAS ÚLTIMOS 12 MESES</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>{fmtMoney(kpi.ventas12)}</div>
            </div>
            {(() => {
              const delta = kpi.ventas0 > 0 ? ((kpi.ventas12 - kpi.ventas0) / kpi.ventas0) * 100 : null;
              const col = delta == null ? '#9a9a98' : delta >= 0 ? '#059669' : '#dc2626';
              return (
                <div>
                  <div style={{ fontSize: 11, color: '#9a9a98', fontWeight: 600 }}>12M ANTERIORES: {fmtMoney(kpi.ventas0)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: col }}>
                    {delta == null ? '—' : (delta >= 0 ? '▲ +' : '▼ ') + delta.toFixed(1) + '%'}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Ventas mensuales (barras) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Ventas mensuales <span style={{ fontWeight: 400, color: '#9a9a98' }}>(verde = este período · gris = año anterior)</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
              {overview.meses.map((m) => {
                const a = overview.mesActual[m] || 0, p = overview.mesPrev[m] || 0;
                return (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 90, width: '100%', justifyContent: 'center' }}>
                      <div title={'Año anterior: ' + fmtMoney(p)} style={{ width: '42%', height: (p / maxMes * 90) + 'px', background: '#e5e7eb', borderRadius: '2px 2px 0 0' }} />
                      <div title={'Este período: ' + fmtMoney(a)} style={{ width: '42%', height: (a / maxMes * 90) + 'px', background: G, borderRadius: '2px 2px 0 0' }} />
                    </div>
                    <div style={{ fontSize: 9, color: '#9a9a98' }}>{fmtMes(m)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranking ABC */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Ranking ABC de la cartera</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'A', 'B', 'C'].map((c) => (
                <button key={c || 'all'} onClick={() => { setFiltroClase(c); setShowAll(false); }}
                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (filtroClase === c ? (CLASE_COLOR[c] || '#374151') : '#e5e7eb'), background: filtroClase === c ? (CLASE_COLOR[c] || '#374151') : '#fff', color: filtroClase === c ? '#fff' : '#6b7280' }}>
                  {c || 'Todos'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ border: '1px solid #f0f0ef', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa', color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600, width: 36 }}>#</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Cliente</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, width: 44 }}>Clase</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Ventas 12m</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>12m ant.</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', width: 70 }}>Var.</th>
                </tr>
              </thead>
              <tbody>
                {rankShown.map((x) => {
                  const delta = x.ventas0 > 0 ? ((x.ventas12 - x.ventas0) / x.ventas0) * 100 : null;
                  const col = delta == null ? '#9a9a98' : delta >= 0 ? '#059669' : '#dc2626';
                  return (
                    <tr key={x.rs} style={{ borderTop: '1px solid #f0f0ef' }}>
                      <td style={{ padding: '7px 10px', color: '#9a9a98' }}>{x.puesto}</td>
                      <td style={{ padding: '7px 10px', color: '#1a1a1a' }}>
                        <div style={{ fontWeight: 600 }}>{x.nombre || x.rs}</div>
                        {x.nombre && x.nombre !== x.rs && <div style={{ fontSize: 10, color: '#9a9a98' }}>{x.rs}</div>}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ background: CLASE_COLOR[x.clase] || '#9ca3af', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10 }}>{x.clase}</span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#1a1a1a' }}>{fmtMoney(x.ventas12)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#9a9a98' }}>{fmtMoney(x.ventas0)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: col }}>{delta == null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(0) + '%'}</td>
                    </tr>
                  );
                })}
                {rankShown.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#9a9a98' }}>Sin clientes en esta clase.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rankFiltered.length > 12 && (
            <button onClick={() => setShowAll((s) => !s)}
              style={{ marginTop: 10, background: 'none', border: 'none', color: G, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {showAll ? 'Ver menos' : `Ver los ${rankFiltered.length} clientes`}
            </button>
          )}

          {/* Ventas por familia */}
          {overview.familias?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Ventas por familia <span style={{ fontWeight: 400, color: '#9a9a98' }}>(12m vs 12m anteriores)</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {overview.familias.slice(0, 12).map((f) => {
                  const delta = f.previo > 0 ? ((f.actual - f.previo) / f.previo) * 100 : null;
                  const col = delta == null ? '#9a9a98' : delta >= 0 ? '#059669' : '#dc2626';
                  return (
                    <div key={f.familia} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <div style={{ flex: 1, color: '#374151' }}>{f.familia || '(sin familia)'}</div>
                      <div style={{ width: 110, textAlign: 'right', fontWeight: 600, color: '#1a1a1a' }}>{fmtMoney(f.actual)}</div>
                      <div style={{ width: 60, textAlign: 'right', fontWeight: 700, color: col }}>{delta == null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(0) + '%'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 16 }}>
            Corte: {overview.corte}. Importes netos (sin IVA) del informe de Mercado.
          </div>
        </div>
      )}
    </div>
  );
}

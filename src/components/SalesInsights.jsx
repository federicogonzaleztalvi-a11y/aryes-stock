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
import ExcelJS from 'exceljs';
import { getAuthHeaders } from '../lib/constants.js';

const G = '#3a7d1e';
const CHUNK = 2500;                       // filas por tanda (server tope 3000)
const CLASE_COLOR = { A: '#059669', B: '#d97706', C: '#9ca3af' };

// Buckets de los KPI: mismo criterio que el server (a=ventas12, b=ventas0), para
// poder filtrar el ranking al clickear una tarjeta y mostrar QUIÉNES son.
const KPI_DEF = {
  activos:  { label: 'Clientes activos',   pred: (x) => x.ventas12 > 0 },
  crecen:   { label: 'Creciendo',          pred: (x) => x.ventas0 > 0 && x.ventas12 > x.ventas0 * 1.1 },
  decrecen: { label: 'Decreciendo',        pred: (x) => x.ventas0 > 0 && x.ventas12 < x.ventas0 * 0.9 },
  perdidos: { label: 'Dejaron de comprar', pred: (x) => x.ventas0 > 0 && x.ventas12 <= 0 },
  nuevos:   { label: 'Nuevos',             pred: (x) => x.ventas0 <= 0 && x.ventas12 > 0 },
};
// Qué significa cada bucket y qué hacer con esos clientes (se muestra al filtrar).
const KPI_DESC = {
  activos:  'Compraron al menos una vez en los últimos 12 meses.',
  crecen:   'Compran 10%+ que el período anterior. Buen momento para ofrecerles más.',
  decrecen: 'Compran 10%+ menos que antes. Conviene contactarlos antes de perderlos.',
  perdidos: 'Venían comprando y este período no compraron nada. Entrá a cada uno para ver qué dejó de llevar.',
  nuevos:   'Empezaron a comprar este período. Reforzá el vínculo para que repitan.',
};

const two = (v) => String(v).padStart(2, '0');
const fmtMoney = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY');
const fmtMes = (ym) => {
  const [, m] = ym.split('-');
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1] || ym;
};

// Opciones del selector de período: fin de cada mes entre 'desde' y 'hasta'
// (más reciente primero). value = 'YYYY-MM-DD' (último día del mes) para ?corte=.
function monthEndOptions(desde, hasta) {
  if (!desde || !hasta) return [];
  const start = new Date(desde + 'T00:00:00Z');
  const end = new Date(hasta + 'T00:00:00Z');
  const sy = start.getUTCFullYear(), sm = start.getUTCMonth();
  let y = end.getUTCFullYear(), m = end.getUTCMonth();
  const out = [];
  while (y > sy || (y === sy && m >= sm)) {
    const d = new Date(Date.UTC(y, m + 1, 0));
    const ym = d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1);
    out.push({ value: ym + '-' + two(d.getUTCDate()), label: fmtMes(ym) + ' ' + d.getUTCFullYear() });
    m--; if (m < 0) { m = 11; y--; }
  }
  return out;
}

// ── Excel de la ficha (exceljs, estilo del script original) ──
const BROWN = 'FF7A3E1D', GREY = 'FF595959';
const NUMFMT = '#,##0;\\(#,##0\\);\\-';
async function descargarFichaExcel(ficha) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pazque';
  const titulo = ficha.nombre || ficha.rs;

  const fillH = { type: 'pattern', pattern: 'solid', fgColor: { argb: BROWN } };
  const border = { top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } } };
  const headerRow = (ws, cells, r) => {
    const row = ws.getRow(r);
    cells.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v; c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = fillH; c.border = border; c.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    });
    row.height = 24;
  };

  // ── Resumen ──
  const R = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  R.columns = [{ width: 46 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 12 }];
  R.getCell('A1').value = 'Ficha de cliente · ' + titulo;
  R.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: BROWN } };
  R.getCell('A2').value = `Clase ${ficha.clase}${ficha.puesto ? ' · puesto #' + ficha.puesto : ''} · corte ${ficha.corte}`;
  R.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: GREY } };
  if (ficha.nombre && ficha.nombre !== ficha.rs) { R.getCell('A3').value = ficha.rs; R.getCell('A3').font = { name: 'Arial', size: 9, color: { argb: GREY } }; }

  let r = 5;
  const sec = (ws, title) => { headerRow(ws, [title], r); r++; };
  const val = (label, value, money) => {
    const row = R.getRow(r);
    row.getCell(1).value = label; row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: GREY } };
    const c = row.getCell(2); c.value = value;
    if (money) c.numFmt = NUMFMT;
    c.font = { name: 'Arial', size: 10 };
    r++;
  };
  sec(R, 'Ventas');
  val('Últimos 12 meses', Math.round(ficha.v12), true);
  val('12 meses anteriores', Math.round(ficha.v0), true);
  val('Variación', ficha.v0 > 0 ? Math.round((ficha.v12 / ficha.v0 - 1) * 100) + '%' : 'cliente nuevo');
  val('Última compra', ficha.ultima);
  val('Días sin comprar', ficha.diasSinComprar);
  r++;

  sec(R, 'Análisis');
  ficha.analisis.forEach((line) => {
    const row = R.getRow(r); const c = row.getCell(1);
    c.value = line; c.font = { name: 'Arial', size: 9 }; c.alignment = { wrapText: true, vertical: 'top' };
    R.mergeCells(r, 1, r, 5); row.height = Math.max(16, Math.ceil(line.length / 90) * 14);
    r++;
  });
  r++;

  const twoColTable = (title, rows, difLabel) => {
    sec(R, title);
    headerRow(R, ['Producto', difLabel], r); r++;
    if (!rows.length) { R.getCell(r, 1).value = '(nada relevante)'; R.getCell(r, 1).font = { name: 'Arial', size: 9, color: { argb: GREY } }; r++; }
    rows.forEach((x) => {
      const row = R.getRow(r);
      row.getCell(1).value = x.producto; row.getCell(1).font = { name: 'Arial', size: 10 }; row.getCell(1).border = border;
      const c = row.getCell(2); c.value = Math.round(x.dif); c.numFmt = NUMFMT; c.border = border;
      c.font = { name: 'Arial', size: 10, color: { argb: x.dif < 0 ? 'FFC00000' : 'FF00803C' } };
      r++;
    });
    r++;
  };
  twoColTable('Lo que dejó de llevar', ficha.perdidos, 'Diferencia anual');
  twoColTable('Lo que creció', ficha.crecidos, 'Diferencia anual');

  sec(R, 'Lo que más compra (12m)');
  headerRow(R, ['Producto', 'Importe 12m'], r); r++;
  ficha.topProductos.forEach((x) => {
    const row = R.getRow(r);
    row.getCell(1).value = x.producto; row.getCell(1).font = { name: 'Arial', size: 10 }; row.getCell(1).border = border;
    const c = row.getCell(2); c.value = Math.round(x.importe); c.numFmt = NUMFMT; c.border = border; c.font = { name: 'Arial', size: 10 };
    r++;
  });

  // ── Compras por mes (12m vs año anterior) ──
  const CO = wb.addWorksheet('Compras por mes', { views: [{ showGridLines: false }] });
  CO.columns = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 12 }];
  headerRow(CO, ['Mes', 'Este período', 'Año anterior', 'Variación'], 1);
  ficha.meses.forEach((m, i) => {
    const row = CO.getRow(i + 2);
    row.getCell(1).value = fmtMes(m) + ' ' + m.slice(2, 4);
    const a = Math.round(ficha.mesActual[m] || 0), p = Math.round(ficha.mesPrev[m] || 0);
    row.getCell(2).value = a; row.getCell(2).numFmt = NUMFMT;
    row.getCell(3).value = p; row.getCell(3).numFmt = NUMFMT;
    row.getCell(4).value = p > 0 ? Math.round((a / p - 1) * 100) / 100 : null; row.getCell(4).numFmt = '0%';
    [1, 2, 3, 4].forEach((j) => { row.getCell(j).border = border; row.getCell(j).font = { name: 'Arial', size: 10 }; });
  });

  // ── Familias ──
  const FA = wb.addWorksheet('Familias', { views: [{ showGridLines: false }] });
  FA.columns = [{ width: 36 }, { width: 16 }, { width: 16 }, { width: 12 }];
  headerRow(FA, ['Familia', '12m', '12m ant.', 'Variación'], 1);
  (ficha.familias || []).forEach((f, i) => {
    const row = FA.getRow(i + 2);
    row.getCell(1).value = f.familia || '(sin familia)';
    row.getCell(2).value = Math.round(f.actual); row.getCell(2).numFmt = NUMFMT;
    row.getCell(3).value = Math.round(f.previo); row.getCell(3).numFmt = NUMFMT;
    row.getCell(4).value = f.previo > 0 ? Math.round((f.actual / f.previo - 1) * 100) / 100 : null; row.getCell(4).numFmt = '0%';
    [1, 2, 3, 4].forEach((j) => { row.getCell(j).border = border; row.getCell(j).font = { name: 'Arial', size: 10 }; });
  });

  // ── Notas de visita (plantilla en blanco) ──
  const NV = wb.addWorksheet('Notas de visita', { views: [{ showGridLines: false }] });
  NV.columns = [{ width: 22 }, { width: 18 }, { width: 20 }, { width: 55 }, { width: 40 }];
  NV.getCell('A1').value = 'Cliente y visitas · ' + titulo;
  NV.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: BROWN } };
  headerRow(NV, ['Fecha', 'Tipo (visita / llamada / WhatsApp)', 'Con quién', 'Qué se habló', 'Acuerdos / pedido'], 3);
  for (let i = 4; i < 24; i++) for (let j = 1; j <= 5; j++) {
    const c = NV.getRow(i).getCell(j); c.border = border; c.font = { name: 'Arial', size: 10 }; c.alignment = { wrapText: true, vertical: 'top' };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Ficha_' + titulo.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

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
  const [filtroKpi, setFiltroKpi] = useState('');       // '' | activos | crecen | decrecen | perdidos | nuevos
  const [canal, setCanal] = useState('');              // '' = todos · 'mercado' · 'portal'
  const [corte, setCorte] = useState('');              // '' = último mes completo
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [ficha, setFicha] = useState(null);           // detalle de cliente abierto
  const [fichaLoading, setFichaLoading] = useState(false);
  const fileRef = useRef(null);
  const rankingRef = useRef(null);

  const abrirFicha = useCallback(async (rs) => {
    setFicha(null); setFichaLoading(true);
    try {
      const qs = new URLSearchParams({ action: 'ficha', rs });
      if (canal) qs.set('canal', canal);
      if (corte) qs.set('corte', corte);
      const r = await fetch('/api/sales-analytics?' + qs.toString(), { headers: getAuthHeaders() });
      if (r.ok) setFicha(await r.json());
    } catch { /* noop */ } finally { setFichaLoading(false); }
  }, [canal, corte]);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/sales-analytics?action=status', { headers: getAuthHeaders() });
      if (!r.ok) { setStatus(null); return; }
      const d = await r.json();
      setStatus(d.lines > 0 ? d : null);
    } catch { setStatus(null); }
  }, []);

  const loadOverview = useCallback(async (canalArg = '', corteArg = '') => {
    setOverviewLoading(true);
    try {
      const qs = new URLSearchParams({ action: 'overview' });
      if (canalArg) qs.set('canal', canalArg);
      if (corteArg) qs.set('corte', corteArg);
      const r = await fetch('/api/sales-analytics?' + qs.toString(), { headers: getAuthHeaders() });
      if (!r.ok) return;
      const d = await r.json();
      setOverview(d.empty ? null : d);
    } catch { /* noop */ } finally { setOverviewLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status && status.lines > 0 && open) loadOverview(canal, corte); }, [status, open, canal, corte, loadOverview]);

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
      setCanal(''); setCorte(''); setFiltroKpi('');   // informe nuevo → vista completa por defecto
      await loadStatus();
      setOpen(true);                     // el efecto recarga el overview
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
  const activosCount = ranking.filter((x) => x.ventas12 > 0).length;
  const rankFiltered = ranking.filter((x) =>
    (!filtroClase || x.clase === filtroClase) &&
    (!filtroKpi || KPI_DEF[filtroKpi].pred(x)));
  // "Dejaron de comprar" tienen ventas12=0 → el orden por ventas12 no dice nada.
  // Los ordenamos por lo que compraban antes (mayor primero): primero el grande.
  if (filtroKpi === 'perdidos') rankFiltered.sort((a, b) => b.ventas0 - a.ventas0);
  // Si filtramos por un KPI, mostramos TODOS los clientes de ese bucket (el punto
  // es ver quiénes son); si no, el top 12 con botón "ver más".
  const rankShown = (showAll || filtroKpi) ? rankFiltered : rankFiltered.slice(0, 12);
  const maxMes = overview ? Math.max(1, ...overview.meses.map((m) => Math.max(overview.mesActual[m] || 0, overview.mesPrev[m] || 0))) : 1;

  // Clickear una tarjeta filtra el ranking al bucket correspondiente y baja la
  // vista a la tabla → el dueño ve QUIÉNES son esos clientes (y entra a la ficha).
  const verKpi = (key) => {
    setFiltroKpi((prev) => {
      const next = prev === key ? '' : key;
      if (next) setTimeout(() => rankingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return next;
    });
    setFiltroClase('');
    setShowAll(false);
  };
  const card = (key, label, value, color, sub) => {
    const active = filtroKpi === key;
    const n = typeof value === 'number' ? value : 0;
    return (
      <div onClick={() => n > 0 && verKpi(key)}
        style={{ background: active ? '#f8faf5' : '#fff', borderRadius: 10, padding: '14px 16px',
          border: '1px solid ' + (active ? G : '#f0f0ef'), cursor: n > 0 ? 'pointer' : 'default',
          transition: 'border-color .12s' }}
        onMouseEnter={(e) => { if (n > 0 && !active) e.currentTarget.style.borderColor = '#d6d6d4'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = '#f0f0ef'; }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#9a9a98', marginTop: 2 }}>{sub}</div>}
        {n > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: active ? G : '#c0c0be', marginTop: 6 }}>{active ? '✓ viendo abajo' : 'ver clientes ›'}</div>}
      </div>
    );
  };

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
              {busy ? '⏳ Importando…' : status ? '↻ Actualizar historial' : '↑ Importar historial ERP'}
            </button>
          </>
        )}
      </div>

      {prog && <div style={{ marginTop: 12, fontSize: 12, color: G }}>{prog}</div>}
      {err && <div style={{ marginTop: 12, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}

      {open && !status && !busy && (
        <div style={{ marginTop: 16, textAlign: 'center', padding: '28px 20px', color: '#6b7280', fontSize: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Todavía no hay datos de ventas</div>
          Se arma solo con los <b>pedidos del portal</b>: a medida que tus clientes compran, vas viendo
          el ranking ABC de la cartera, quién crece, quién dejó de comprar y las ventas mes a mes.<br />
          <span style={{ fontSize: 12, color: '#9a9a98' }}>
            ¿Ya tenés historial en un ERP? Si bajás el informe <b>“Movimiento de productos”</b> lo sumás
            de una (opcional).
          </span>
        </div>
      )}

      {open && status && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {status.canales?.portal > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[['', 'Todos'], ['mercado', 'Mercado'], ['portal', 'Portal']].map(([v, lbl]) => (
                <button key={v || 'all'} onClick={() => { setCanal(v); setFiltroKpi(''); setShowAll(false); }}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (canal === v ? G : '#e5e7eb'), background: canal === v ? G : '#fff', color: canal === v ? '#fff' : '#6b7280' }}>
                  {lbl}
                </button>
              ))}
            </div>
          )}
          {(() => {
            const opts = monthEndOptions(status.desde, status.hasta);
            return opts.length > 1 ? (
              <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                Período hasta
                <select value={corte} onChange={(e) => { setCorte(e.target.value); setFiltroKpi(''); setShowAll(false); }}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                  <option value="">Último mes completo</option>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ) : null;
          })()}
          {overviewLoading && <span style={{ fontSize: 11, color: '#9a9a98' }}>actualizando…</span>}
        </div>
      )}

      {open && status && !overview && !overviewLoading && (
        <div style={{ marginTop: 16, textAlign: 'center', color: '#9a9a98', fontSize: 13, padding: 20 }}>
          Sin datos de ventas para este filtro.
        </div>
      )}

      {open && status && overview && (
        <div style={{ marginTop: 14 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
            {card('activos', 'Clientes activos (12m)', activosCount, '#374151', `${overview.totalClientes} en total`)}
            {card('crecen', 'Creciendo', kpi.crecen, '#059669', '+10% vs año anterior')}
            {card('decrecen', 'Decreciendo', kpi.decrecen, '#d97706', '−10% vs año anterior')}
            {card('perdidos', 'Dejaron de comprar', kpi.perdidos, '#dc2626', 'compraban y pararon')}
            {card('nuevos', 'Nuevos', kpi.nuevos, G, 'empezaron este período')}
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
          <div ref={rankingRef} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Ranking ABC de la cartera</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'A', 'B', 'C'].map((c) => (
                <button key={c || 'all'} onClick={() => { setFiltroClase(c); setFiltroKpi(''); setShowAll(false); }}
                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (filtroClase === c ? (CLASE_COLOR[c] || '#374151') : '#e5e7eb'), background: filtroClase === c ? (CLASE_COLOR[c] || '#374151') : '#fff', color: filtroClase === c ? '#fff' : '#6b7280' }}>
                  {c || 'Todos'}
                </button>
              ))}
            </div>
            {filtroKpi && (
              <button onClick={() => setFiltroKpi('')}
                style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px 3px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + G, background: G, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {KPI_DEF[filtroKpi].label} ({rankFiltered.length}) <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
              </button>
            )}
          </div>
          {filtroKpi && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.45 }}>{KPI_DESC[filtroKpi]}</div>
          )}
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
                    <tr key={x.rs} onClick={() => abrirFicha(x.rs)} style={{ borderTop: '1px solid #f0f0ef', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
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
                  <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#9a9a98' }}>{filtroKpi ? 'Ningún cliente en este grupo.' : 'Sin clientes en esta clase.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!filtroKpi && rankFiltered.length > 12 && (
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
            Corte: {overview.corte}. {canal === 'portal'
              ? 'Pedidos del portal.'
              : canal === 'mercado'
                ? 'Informe de Mercado (importes netos, sin IVA).'
                : 'Mercado (neto, sin IVA) + pedidos del portal.'}
          </div>
        </div>
      )}

      {(ficha || fichaLoading) && (
        <FichaModal ficha={ficha} loading={fichaLoading} onClose={() => { setFicha(null); setFichaLoading(false); }} />
      )}
    </div>
  );
}

// ── Modal: ficha de un cliente ──
function FichaModal({ ficha, loading, onClose }) {
  const maxMes = ficha ? Math.max(1, ...ficha.meses.map((m) => Math.max(ficha.mesActual[m] || 0, ficha.mesPrev[m] || 0))) : 1;
  const delta = ficha && ficha.v0 > 0 ? ((ficha.v12 - ficha.v0) / ficha.v0) * 100 : null;
  const deltaCol = delta == null ? '#9a9a98' : delta >= 0 ? '#059669' : '#dc2626';
  const ddmmyy = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 760, boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        {loading && !ficha && (
          <div style={{ padding: 48, textAlign: 'center', color: '#9a9a98', fontSize: 13 }}>Cargando ficha…</div>
        )}
        {ficha && (
          <>
            {/* header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0ef', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: CLASE_COLOR[ficha.clase] || '#9ca3af', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 10 }}>Clase {ficha.clase}</span>
                  {ficha.puesto && <span style={{ fontSize: 12, color: '#9a9a98' }}>#{ficha.puesto} de la cartera</span>}
                </div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, color: '#1a1a1a', marginTop: 6 }}>{ficha.nombre || ficha.rs}</div>
                {ficha.nombre && ficha.nombre !== ficha.rs && <div style={{ fontSize: 12, color: '#9a9a98' }}>{ficha.rs}</div>}
              </div>
              <button onClick={() => descargarFichaExcel(ficha)} title="Descargar ficha en Excel"
                style={{ background: '#fff', color: G, border: `1px solid ${G}`, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                ↓ Excel
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9a9a98', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* ventas + delta */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9a9a98', fontWeight: 600 }}>ÚLTIMOS 12 MESES</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>{fmtMoney(ficha.v12)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9a9a98', fontWeight: 600 }}>12M ANTERIORES: {fmtMoney(ficha.v0)}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: deltaCol }}>{delta == null ? 'cliente nuevo' : (delta >= 0 ? '▲ +' : '▼ ') + delta.toFixed(1) + '%'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Última compra: <b>{ddmmyy(ficha.ultima)}</b>{ficha.diasSinComprar > 0 && <> · hace {ficha.diasSinComprar} días</>}
                </div>
              </div>

              {/* barras mensuales */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                  {ficha.meses.map((m) => {
                    const a = ficha.mesActual[m] || 0, p = ficha.mesPrev[m] || 0;
                    return (
                      <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64, width: '100%', justifyContent: 'center' }}>
                          <div title={'Año ant.: ' + fmtMoney(p)} style={{ width: '42%', height: (p / maxMes * 64) + 'px', background: '#e5e7eb', borderRadius: '2px 2px 0 0' }} />
                          <div title={'Este período: ' + fmtMoney(a)} style={{ width: '42%', height: (a / maxMes * 64) + 'px', background: G, borderRadius: '2px 2px 0 0' }} />
                        </div>
                        <div style={{ fontSize: 9, color: '#9a9a98' }}>{fmtMes(m)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* análisis 5 líneas */}
              <div style={{ background: '#f8faf5', border: '1px solid #e3edd8', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                {ficha.analisis.map((line, i) => {
                  const [head, ...rest] = line.split(':');
                  return (
                    <div key={i} style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5, marginBottom: i < ficha.analisis.length - 1 ? 8 : 0 }}>
                      <b style={{ color: '#1a1a18' }}>{head}:</b>{rest.join(':')}
                    </div>
                  );
                })}
              </div>

              {/* perdidos / crecidos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Lo que dejó de llevar</div>
                  {ficha.perdidos.length ? ficha.perdidos.map((x, i) => (
                    <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid #f5f5f4' }}>
                      <span style={{ color: '#374151' }}>{x.producto}</span>
                      <span style={{ color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>−{fmtMoney(-x.dif).replace('$ ', '')}</span>
                    </div>
                  )) : <div style={{ fontSize: 12, color: '#9a9a98' }}>Nada relevante.</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 6 }}>Lo que creció</div>
                  {ficha.crecidos.length ? ficha.crecidos.map((x, i) => (
                    <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid #f5f5f4' }}>
                      <span style={{ color: '#374151' }}>{x.producto}</span>
                      <span style={{ color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>+{fmtMoney(x.dif).replace('$ ', '')}</span>
                    </div>
                  )) : <div style={{ fontSize: 12, color: '#9a9a98' }}>Nada relevante.</div>}
                </div>
              </div>

              {/* top productos */}
              {ficha.topProductos?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Lo que más compra (12m)</div>
                  {ficha.topProductos.slice(0, 10).map((x, i) => (
                    <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid #f5f5f4' }}>
                      <span style={{ color: '#374151' }}>{x.producto}</span>
                      <span style={{ color: '#1a1a1a', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(x.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

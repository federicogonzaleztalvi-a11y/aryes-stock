import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { db, getAuthHeaders, getOrgId } from '../lib/constants.js';

const G = '#059669';
const SANS = 'Inter,system-ui,sans-serif';

function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ').trim();
}

function extractSize(name) {
  const n = name.toLowerCase();
  // Match kg with comma decimal: 2,5 kgs or 2.5 kg
  let m = n.match(/(\d+[,.]\d+|\d+)\s*kgs?\.?/);
  if (m) return parseFloat(m[1].replace(',', '.')) + 'kg';
  // Match grams
  m = n.match(/(\d+[,.]?\d*)\s*(?:grs?|gramas?|g\.(?:\s|$)|g(?:\s|$))/);
  if (m) return (parseFloat(m[1].replace(',', '.')) / 1000) + 'kg';
  m = n.match(/(\d+[,.]?\d*)\s*(?:lt?s?|litros?)\.?/);
  if (m) return m[1] + 'lt';
  return null;
}

function similarity(a, b) {
  const wa = new Set(norm(a).split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(norm(b).split(/\s+/).filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let matches = 0;
  wa.forEach(w => { if (wb.has(w)) matches++; });
  let score = matches / Math.max(wa.size, wb.size);
  // Bonus if same size, penalty if different size
  const sa = extractSize(a);
  const sb = extractSize(b);
  if (sa && sb) {
    if (sa === sb) score = Math.min(1, score + 0.3);
    else score = score * 0.5;
  }
  return score;
}

function extractWeightKg(name) {
  const n = name.toLowerCase();
  let m = n.match(/(\d+[,.]\d+|\d+)\s*kgs?\.?/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  m = n.match(/(\d+[,.]?\d*)\s*(?:grs?|gramas?|g\.(?:\s|$)|g(?:\s|$))/);
  if (m) return parseFloat(m[1].replace(',', '.')) / 1000;
  return null;
}

// Tamaño fijo del bulto: kg/g o litros. Null = peso variable (ej. "x kg").
function extractPackSize(name) {
  const kg = extractWeightKg(name);
  if (kg != null) return kg;
  const n = String(name).toLowerCase();
  // ml / cc → litros (un envase de 900 ml = 0,9 lt). Va antes que litros.
  let m = n.match(/(\d+[,.]?\d*)\s*(?:ml|cc)\b\.?/);
  if (m) return parseFloat(m[1].replace(',', '.')) / 1000;
  m = n.match(/(\d+[,.]?\d*)\s*(?:lt?s?|litros?)\.?/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

// Normaliza el precio de la lista del distribuidor a "precio por bulto que se vende".
// La propia etiqueta de unidad indica la operación:
//   /un · /unid · /caja → el precio ya es por bulto → se usa tal cual
//   /kg · /lt           → el precio es por kilo/litro → se multiplica por el tamaño del bulto del nombre
// Ej: "Ganache 4 kg." a 344/kg → 1377 · "Pastamix 3 kgs." /un a 1122 → 1122 (bolsa entera)
function calcPrecioUnit(precioKg, nombreExcel, unidad) {
  const u = String(unidad || '').toLowerCase();
  if (u.includes('/un') || u.includes('/caja') || u.includes('/cj')) return precioKg;
  const pack = extractPackSize(nombreExcel);
  if (pack) return Math.round(precioKg * pack * 100) / 100;
  return precioKg;
}

// Aplica la regla de conversión del template: × factor, ÷ factor o directo.
// Si no hay factor cargado, intenta inferir el tamaño del bulto desde el nombre (solo para ×).
function calcFromRule(precio, oper, factor, nombre) {
  const o = String(oper || '').toLowerCase().trim();
  const isDiv = o === '÷' || o === '/' || o.includes('div');
  const isMul = o === '×' || o === 'x' || o === '*' || o.includes('mult');
  let f = factor;
  if ((!f || f <= 0) && !isDiv) {
    const auto = extractPackSize(nombre);
    if (auto && auto > 0) f = auto;
  }
  if (isDiv && f > 0) return Math.round((precio / f) * 100) / 100;
  if (isMul && f > 0) return Math.round((precio * f) * 100) / 100;
  return precio; // directo
}

export default function ImportadorPrecios({ products = [], listas = [], onPreciosGuardados }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [step, setStep] = useState('upload');
  const [listaId, setListaId] = useState('');
  const fileRef = useRef();

  const parseExcel = (arrayBuffer) => {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Detect template format: has 'Nombre Pazque' column
    if (raw.length > 0) {
      const keys = Object.keys(raw[0]).map(k => k.toLowerCase());
      const hasNombrePazque = keys.some(k => k.includes('nombre pazque') || k.includes('nombre_pazque'));
      if (hasNombrePazque) {
        // New template format — match by exact name
        const items = [];
        for (const row of raw) {
          const lc = k => k.toLowerCase();
          const nombreKey = Object.keys(row).find(k => lc(k).includes('nombre pazque') || lc(k).includes('nombre_pazque'));
          const operKey = Object.keys(row).find(k => lc(k).includes('operaci'));
          const factorKey = Object.keys(row).find(k => lc(k).includes('factor'));
          const finalKey = Object.keys(row).find(k => lc(k).includes('precio final') || lc(k).includes('precio_final'));
          const precioKey = Object.keys(row).find(k => !lc(k).includes('final') && (lc(k) === 'precio' || lc(k).includes('precio/kg') || lc(k).includes('precio_kg') || lc(k).includes('precio base')));
          const dtoKey = Object.keys(row).find(k => lc(k).includes('descuento') || lc(k).includes('dto'));
          const unidadKey = Object.keys(row).find(k => lc(k) === 'unidad');

          if (!nombreKey) continue;
          const nombre = String(row[nombreKey] || '').trim();
          if (!nombre || nombre.includes('NO EDITAR') || nombre.includes('INSTRUCCIONES')) continue;

          const precioFinal = finalKey ? parseFloat(String(row[finalKey]).replace(',','.')) || 0 : 0;
          const precio = precioKey ? parseFloat(String(row[precioKey]).replace(',','.')) || 0 : 0;
          const factor = factorKey ? (parseFloat(String(row[factorKey]).replace(',','.')) || 0) : 0;
          const oper = operKey ? String(row[operKey]).trim() : '';
          const descuento = dtoKey ? parseFloat(String(row[dtoKey]).replace(',','.')) || 0 : 0;
          const unidad = unidadKey ? String(row[unidadKey]).trim() : '';

          if (precioFinal <= 0 && precio <= 0) continue;

          // Si la fórmula del Excel ya dejó un Precio Final cacheado, se usa tal cual.
          // Si no, se aplica la regla guardada (× factor, ÷ factor o directo).
          const precioUnit = precioFinal > 0 ? precioFinal : calcFromRule(precio, oper, factor, nombre);

          items.push({ nombreExcel: nombre, precioKg: precio, unidad, descuento, precioUnit, exactMatch: true });
        }
        return items;
      }
    }

    // Formato nativo del distribuidor (ej. lista de Eric): Nombre … $ Precio /unidad
    // Se ancla en la celda "$" en vez de la posición de columna, porque puede haber
    // notas intermedias (ej. "dosif. 60 grs./lt.") que corren las columnas.
    const rawArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const items = [];
    for (const rowArr of rawArr) {
      const dollarIdx = rowArr.findIndex(c => String(c).trim() === '$');
      if (dollarIdx === -1) continue;
      const nombre = String(rowArr[0] || '').trim();
      const precio = parseFloat(String(rowArr[dollarIdx + 1]).replace(',', '.'));
      if (!nombre || isNaN(precio) || precio <= 0) continue;
      const unidad = String(rowArr[dollarIdx + 2] || '/kg.').trim();
      const dtoRaw = rowArr[dollarIdx + 3];
      const descuento = typeof dtoRaw === 'number' ? dtoRaw : (parseFloat(String(dtoRaw).replace(',', '.')) || 0);
      items.push({ nombreExcel: nombre, precioKg: precio, unidad, descuento });
    }
    return items;
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const items = parseExcel(ev.target.result);
        if (items.length === 0) { setMsg('No se encontraron productos con precio en el archivo.'); return; }
        const matched = items.map(item => {
          const precioUnit = item.precioUnit || calcPrecioUnit(item.precioKg, item.nombreExcel, item.unidad);
          let bestMatch = null, bestScore = 0;
          if (item.exactMatch) {
            // Template format: exact name match
            const exact = products.find(p => p.name === item.nombreExcel);
            if (exact) { bestMatch = exact; bestScore = 1.0; }
            else {
              // Fallback to similarity
              for (const p of products) {
                const score = similarity(item.nombreExcel, p.name);
                if (score > bestScore) { bestScore = score; bestMatch = p; }
              }
            }
          } else {
            for (const p of products) {
              const score = similarity(item.nombreExcel, p.name);
              if (score > bestScore) { bestScore = score; bestMatch = p; }
            }
          }
          return {
            nombreExcel: item.nombreExcel,
            precioKg: item.precioKg,
            precioUnit,
            unidad: item.unidad,
            descuento: item.descuento || 0,
            matchScore: bestScore,
            productoId: bestScore >= 0.4 ? bestMatch?.id : null,
            productoNombre: bestScore >= 0.4 ? bestMatch?.name : '',
            precioFinal: precioUnit,
            incluir: bestScore >= 0.4,
          };
        });
        setRows(matched);
        setStep('review');
        setMsg('');
      } catch(err) { setMsg('Error al leer el archivo: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const updateRow = (i, field, val) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const guardar = async () => {
    const toSave = rows.filter(r => r.incluir && r.productoId);
    if (toSave.length === 0) { setMsg('No hay productos seleccionados.'); return; }
    if (!listaId) { setMsg('Seleccioná una lista de precios primero.'); return; }
    setSaving(true);
    let ok = 0, err = 0, firstErr = '';
    const SB_URL = import.meta.env.VITE_SUPABASE_URL;
    const headers = getAuthHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' });
    for (const row of toSave) {
      try {
        const res = await fetch(`${SB_URL}/rest/v1/price_list_items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ lista_id: listaId, org_id: getOrgId(), product_uuid: row.productoId, precio: Number(row.precioFinal), descuento: 0 }),
        });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch(e) { console.warn(e); err++; if (!firstErr) firstErr = String(e.message || e).slice(0, 160); }
    }
    setSaving(false);
    setStep('done');
    setMsg(`${ok} precios guardados en la lista${err > 0 ? `, ${err} errores — ${firstErr}` : ''}.`);
    if (onPreciosGuardados) onPreciosGuardados();
  };

  const descargarTemplate = async () => {
    if (!products || products.length === 0) { setMsg('No hay productos para exportar.'); return; }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Precios');

      // Columnas: A Nombre · B Unidad · C Operación · D Factor · E Precio · F Descuento% · G Precio Final
      const widths = [42, 10, 11, 9, 13, 12, 14];
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      // Fila 1 — instrucciones
      ws.mergeCells('A1:G1');
      const inst = ws.getCell('A1');
      inst.value = 'Completá solo "Precio" con el número de tu lista. El "Precio Final" se calcula solo aplicando la regla: × Factor (ej. horma 4kg), ÷ Factor (ej. caja de 12), o directo. La regla ya viene pre-cargada; revisala una vez y listo.';
      inst.font = { italic: true, color: { argb: 'FF6B7280' }, size: 11 };
      inst.alignment = { vertical: 'middle', wrapText: true };
      inst.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      ws.getRow(1).height = 34;

      // Fila 2 — encabezados (verde Pazque, negrita, texto blanco)
      const headers = ['Nombre Pazque', 'Unidad', 'Operación', 'Factor', 'Precio', 'Descuento%', 'Precio Final'];
      const hr = ws.getRow(2);
      headers.forEach((h, i) => {
        const c = hr.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      hr.height = 22;

      // Filas de datos
      const grisFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      const azulFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      const amarilloFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      products.forEach((p, idx) => {
        const r = idx + 3;
        const nombre = p.name || p.nombre || '';
        const unidad = p.unit || p.unidad || 'kg';
        const packSize = extractPackSize(nombre);
        // Regla pre-cargada: si el nombre tiene un tamaño fijo (4kg, 25kg, 5L) → × factor; si no → directo
        const oper = packSize != null ? '×' : 'directo';
        const factor = packSize != null ? packSize : null;
        const row = ws.getRow(r);
        row.getCell(1).value = nombre;
        row.getCell(2).value = unidad;
        row.getCell(3).value = oper;       // Operación (editable, con dropdown)
        row.getCell(4).value = factor;     // Factor (editable)
        row.getCell(5).value = null;       // Precio — lo completa el usuario
        row.getCell(6).value = null;       // Descuento%
        // Fórmula viva: ÷ → Precio/Factor · × → Precio×Factor · directo → Precio
        row.getCell(7).value = { formula: `IF(E${r}="","",IF(AND(C${r}="÷",D${r}<>"",D${r}<>0),E${r}/D${r},IF(AND(C${r}="×",D${r}<>"",D${r}<>0),E${r}*D${r},E${r})))` };
        // Dropdown de Operación
        row.getCell(3).dataValidation = { type: 'list', allowBlank: false, formulae: ['"×,÷,directo"'] };
        // Estilos
        [1, 2].forEach(ci => { row.getCell(ci).fill = grisFill; });
        row.getCell(3).fill = azulFill;
        row.getCell(4).fill = azulFill;
        row.getCell(4).numFmt = '#,##0.###';
        row.getCell(5).fill = amarilloFill;       // Precio resaltado
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(7).fill = grisFill;
        row.getCell(7).font = { bold: true, color: { argb: 'FF374151' } };
        row.getCell(7).numFmt = '#,##0.00';
      });

      // Encabezado fijo + filtros
      ws.views = [{ state: 'frozen', ySplit: 2 }];
      ws.autoFilter = 'A2:G2';

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-precios-pazque.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('');
    } catch (err) {
      setMsg('Error al generar el template: ' + err.message);
    }
  };

  const incluidos = rows.filter(r => r.incluir && r.productoId).length;
  const sinMatch = rows.filter(r => !r.productoId).length;

  if (step === 'upload') return (
    <div style={{ fontFamily: SANS }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a1a' }}>Importar precios desde Excel</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
        Subí tu lista de precios tal como la tenés. El sistema lee el precio y la unidad (/kg, /un, /lt, /caja),
        calcula el precio por bulto automáticamente y muestra los matches para confirmar.
      </p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Lista de precios destino</label>
        <select value={listaId} onChange={e => setListaId(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: '100%', maxWidth: 320 }}>
          <option value="">— Seleccioná una lista —</option>
          {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </div>
      {msg && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>{msg}</div>}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#374151', fontSize: 13, marginBottom: 2 }}>¿No tenés lista propia? Usá nuestro template</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Trae tus {products.length} productos pre-cargados. Solo completá la columna <strong>Precio</strong> y volvé a subirlo. Si ya tenés tu lista, subila directo abajo.</div>
        </div>
        <button onClick={descargarTemplate}
          style={{ padding: '9px 18px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          ↓ Descargar template
        </button>
      </div>
      <div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}
        onClick={() => fileRef.current?.click()}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Subir lista de precios</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Excel con columnas: Producto | $ | Precio | /kg o /un</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    </div>
  );

  if (step === 'done') return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 700, color: G, fontSize: 16 }}>{msg}</div>
      </div>
      <button onClick={() => { setStep('upload'); setRows([]); setMsg(''); }}
        style={{ marginTop: 16, padding: '8px 20px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
        Importar otra lista
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1a1a1a' }}>Revisar matches — {rows.length} productos</h3>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            <span style={{ color: G, fontWeight: 600 }}>{incluidos} para guardar</span>
            {sinMatch > 0 && <span style={{ color: '#f59e0b', marginLeft: 12 }}>⚠ {sinMatch} sin match</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setStep('upload'); setRows([]); }}
            style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ← Volver
          </button>
          <button onClick={guardar} disabled={saving || incluidos === 0}
            style={{ padding: '7px 20px', background: G, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: incluidos === 0 ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : `Guardar ${incluidos} precios`}
          </button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['✓', 'Nombre en Excel', 'Precio', 'Dto%', 'Producto Pazque', 'Precio final', 'Match'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: !row.productoId ? '#fffbeb' : row.incluir ? '#fff' : '#f9fafb', opacity: row.incluir ? 1 : 0.5 }}>
                <td style={{ padding: '6px 12px' }}>
                  <input type="checkbox" checked={row.incluir && !!row.productoId} disabled={!row.productoId}
                    onChange={e => updateRow(i, 'incluir', e.target.checked)} />
                </td>
                <td style={{ padding: '6px 12px', color: '#374151', maxWidth: 200 }}>{row.nombreExcel}</td>
                <td style={{ padding: '6px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>${row.precioKg}</td>
                <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                  <input type="number" value={row.descuento} min="0" max="100" step="1"
                    onChange={e => updateRow(i, 'descuento', parseFloat(e.target.value) || 0)}
                    style={{ width: 55, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12 }} />%
                </td>
                <td style={{ padding: '6px 12px', minWidth: 180 }}>
                  {row.productoId
                    ? <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{row.productoNombre}</span>
                    : <span style={{ color: '#f59e0b', fontSize: 11 }}>⚠ Sin match</span>}
                </td>
                <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                  <input type="number" value={row.precioFinal} min="0" step="0.01"
                    onChange={e => updateRow(i, 'precioFinal', parseFloat(e.target.value) || 0)}
                    style={{ width: 90, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12 }} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                    background: row.matchScore >= 0.7 ? '#d1fae5' : row.matchScore >= 0.4 ? '#fef3c7' : '#fee2e2',
                    color: row.matchScore >= 0.7 ? G : row.matchScore >= 0.4 ? '#92400e' : '#dc2626' }}>
                    {Math.round(row.matchScore * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

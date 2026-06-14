import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../lib/constants.js';

const G = '#059669';
const SANS = 'Inter,system-ui,sans-serif';

function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ').trim();
}

function similarity(a, b) {
  const wa = new Set(norm(a).split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(norm(b).split(/\s+/).filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let matches = 0;
  wa.forEach(w => { if (wb.has(w)) matches++; });
  return matches / Math.max(wa.size, wb.size);
}

function extractWeightKg(name) {
  const n = name.toLowerCase();
  let m = n.match(/(\d+[,.]?\d*)\s*kgs?\.?/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  m = n.match(/(\d+[,.]?\d*)\s*(?:grs?|gramas?)\.?/);
  if (m) return parseFloat(m[1].replace(',', '.')) / 1000;
  return null;
}

function calcPrecioUnit(precioKg, nombreExcel, unidad) {
  if (unidad && (unidad.includes('/un') || unidad.includes('/lt'))) return precioKg;
  const peso = extractWeightKg(nombreExcel);
  if (peso) return Math.round(precioKg * peso * 100) / 100;
  return precioKg;
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
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const items = [];
    for (const rowArr of raw) {
      const vals = rowArr.map(v => String(v || '').trim()).filter(v => v && v !== '');
      if (vals.length >= 3 && vals[1] === '$') {
        try {
          const precio = parseFloat(vals[2]);
          if (isNaN(precio) || precio <= 0) continue;
          const descuento = vals[4] ? parseFloat(vals[4]) || 0 : 0;
          items.push({ nombreExcel: vals[0], precioKg: precio, unidad: vals[3] || '/kg.', descuento });
        } catch(e) { /* skip */ }
      }
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
          const precioUnit = calcPrecioUnit(item.precioKg, item.nombreExcel, item.unidad);
          let bestMatch = null, bestScore = 0;
          for (const p of products) {
            const score = similarity(item.nombreExcel, p.name);
            if (score > bestScore) { bestScore = score; bestMatch = p; }
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
    let ok = 0, err = 0;
    const SB_URL = import.meta.env.VITE_SUPABASE_URL;
    const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
    for (const row of toSave) {
      try {
        const res = await fetch(`${SB_URL}/rest/v1/price_list_items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ lista_id: listaId, product_uuid: row.productoId, precio: Number(row.precioFinal), descuento: Number(row.descuento) || 0 }),
        });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch(e) { console.warn(e); err++; }
    }
    setSaving(false);
    setStep('done');
    setMsg(`${ok} precios guardados en la lista${err > 0 ? `, ${err} errores` : ''}.`);
    if (onPreciosGuardados) onPreciosGuardados();
  };

  const incluidos = rows.filter(r => r.incluir && r.productoId).length;
  const sinMatch = rows.filter(r => !r.productoId).length;

  if (step === 'upload') return (
    <div style={{ fontFamily: SANS }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a1a' }}>Importar precios desde Excel</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
        Subí la lista de precios. El sistema calcula el precio por unidad automáticamente y muestra los matches para confirmar.
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
              {['✓', 'Nombre en Excel', '$/kg', 'Dto%', 'Producto Pazque', 'Precio unit.', 'Match'].map(h => (
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

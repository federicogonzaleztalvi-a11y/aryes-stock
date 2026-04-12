import React, { useState, useCallback } from 'react';
import { T, Modal, Btn } from '../lib/ui.jsx';

const G = '#059669';
const F = { sans: "'DM Sans','Inter',system-ui,sans-serif" };

// ── Parsear CSV/TSV texto plano ───────────────────────────────────────────────
function parseText(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = cells[i] || '');
    return obj;
  });
  return { headers, rows };
}

// ── Auto-detectar columnas ────────────────────────────────────────────────────
function autoDetectCols(headers) {
  const find = (keys) => headers.find(h => keys.some(k => h.toLowerCase().includes(k))) || '';
  return {
    name:     find(['nombre','name','descripcion','descripción','producto','articulo','artículo','item']),
    code:     find(['codigo','código','cod','ean','barcode','ref','referencia']),
    stock:    find(['stock','cantidad','existencia','saldo','disponible','qty','inventory']),
    price:    find(['precio','price','pvp','venta','sale']),
    cost:     find(['costo','cost','compra','purchase']),
    unit:     find(['unidad','unit','um','medida']),
    category: find(['categoria','categoría','category','rubro','tipo']),
  };
}

// ── Leer archivo XLSX via SheetJS (CDN) ─────────────────────────────────────
async function readXlsx(file) {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = window.XLSX.utils.sheet_to_csv(ws);
        res(csv);
      } catch (err) { rej(err); }
    };
    reader.onerror = rej;
    reader.readAsBinaryString(file);
  });
}

const ColSelect = ({ label, value, onChange, headers, required }) => (
  <div>
    <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: '#6a6a68', marginBottom: 4 }}>
      {label}{required && <span style={{ color: G }}> *</span>}
    </div>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e2de', borderRadius: 8,
        fontFamily: F.sans, fontSize: 12, color: '#1a1a18', background: '#fff', outline: 'none' }}>
      <option value="">— no usar —</option>
      {headers.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  </div>
);

export default function ExcelModal({ products, onApply, onClose, suppliers = [] }) {
  const [step, setStep]       = useState('upload'); // upload | map | preview
  const [headers, setHeaders] = useState([]);
  const [rows, setRows]       = useState([]);
  const [cols, setCols]       = useState({});
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [mode, setMode]       = useState('create'); // create | update | both
  const [dragOver, setDragOver] = useState(false);

  // ── Procesar archivo ────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setLoading(true); setError('');
    try {
      let text = '';
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        text = await readXlsx(file);
      } else {
        text = await file.text();
      }
      const { headers: hdrs, rows: rws } = parseText(text);
      if (hdrs.length === 0) throw new Error('No se pudieron leer las columnas del archivo');
      if (rws.length === 0)  throw new Error('El archivo no tiene filas de datos');
      setHeaders(hdrs);
      setRows(rws);
      setCols(autoDetectCols(hdrs));
      setStep('map');
    } catch (err) {
      setError(err.message || 'Error al leer el archivo');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    const ok = ['.csv','.xlsx','.xls','.tsv'].some(ext => file.name.toLowerCase().endsWith(ext));
    if (!ok) { setError('Formato no soportado. Usá .xlsx, .csv o .tsv'); return; }
    processFile(file);
  };

  // ── Generar preview ─────────────────────────────────────────────────────────
  const buildPreview = () => {
    if (!cols.name) { setError('La columna Nombre es obligatoria'); return; }
    const items = [];
    rows.forEach((row, idx) => {
      const name  = (row[cols.name] || '').trim();
      const code  = cols.code  ? (row[cols.code]  || '').trim() : '';
      const stock = cols.stock ? parseFloat(row[cols.stock]) : 0;
      const price = cols.price ? parseFloat(row[cols.price]) : 0;
      const cost  = cols.cost  ? parseFloat(row[cols.cost])  : 0;
      const unit  = cols.unit  ? (row[cols.unit] || '').trim() : 'u';
      const cat   = cols.category ? (row[cols.category] || '').trim() : '';
      if (!name) return;

      const existing = products.find(p =>
        (code && p.barcode && p.barcode === code) ||
        p.name.toLowerCase() === name.toLowerCase()
      );

      items.push({
        _row: idx + 2,
        name, code, unit, category: cat,
        stock: isNaN(stock) ? 0 : Math.round(stock),
        price: isNaN(price) ? 0 : price,
        cost:  isNaN(cost)  ? 0 : cost,
        existing,
        action: existing ? 'update' : 'create',
      });
    });

    if (items.length === 0) { setError('No se encontraron filas válidas'); return; }
    setPreview(items);
    setError('');
    setStep('preview');
  };

  // ── Aplicar ─────────────────────────────────────────────────────────────────
  const apply = () => {
    const filtered = preview.filter(item =>
      mode === 'both'   ? true :
      mode === 'create' ? item.action === 'create' :
      item.action === 'update'
    );
    onApply(filtered);
    onClose();
  };

  const creates = preview.filter(i => i.action === 'create').length;
  const updates = preview.filter(i => i.action === 'update').length;

  return (
    <Modal title="Importar productos" sub={`${rows.length > 0 ? rows.length + ' filas detectadas' : 'Cargá tu catálogo desde Excel o CSV'}`} onClose={onClose} wide>
      <div style={{ display: 'grid', gap: 20, fontFamily: F.sans }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* ── PASO 1: UPLOAD ── */}
        {step === 'upload' && (
          <div>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('excel-file-input').click()}
              style={{
                border: `2px dashed ${dragOver ? G : '#d1d5db'}`,
                borderRadius: 12, padding: '36px 20px', textAlign: 'center',
                cursor: 'pointer', background: dragOver ? '#f0fdf4' : '#fafafa',
                transition: 'all .15s',
              }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>
                Arrastrá tu archivo o hacé clic para buscarlo
              </div>
              <div style={{ fontSize: 12, color: '#9a9a98' }}>
                .xlsx · .xls · .csv · .tsv — hasta 10 MB
              </div>
              <input id="excel-file-input" type="file" accept=".xlsx,.xls,.csv,.tsv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            {loading && (
              <div style={{ textAlign: 'center', marginTop: 16, color: G, fontSize: 13 }}>
                Leyendo archivo...
              </div>
            )}

            {/* Template descargable */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4',
              borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: G, marginBottom: 4 }}>
                ¿No tenés el archivo en el formato correcto?
              </div>
              <div style={{ fontSize: 11, color: '#6a6a68', marginBottom: 8 }}>
                Descargá la plantilla y completala con tus productos.
              </div>
              <button
                onClick={() => {
                  const csv = 'Nombre,Codigo,Stock,Precio venta,Costo,Unidad\nHarina 000,7790001,150,85,60,kg\nAceite girasol,7790002,80,320,240,lt';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url;
                  a.download = 'plantilla-productos-pazque.csv'; a.click();
                }}
                style={{ background: G, color: '#fff', border: 'none', borderRadius: 6,
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Descargar plantilla CSV
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: MAPEAR COLUMNAS ── */}
        {step === 'map' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8,
              border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
              ✅ Archivo leído — {rows.length} filas encontradas. Verificá el mapeo de columnas.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <ColSelect label="Nombre del producto" required value={cols.name || ''} onChange={v => setCols(c => ({...c, name: v}))} headers={headers} />
              <ColSelect label="Código / EAN" value={cols.code || ''} onChange={v => setCols(c => ({...c, code: v}))} headers={headers} />
              <ColSelect label="Stock inicial" value={cols.stock || ''} onChange={v => setCols(c => ({...c, stock: v}))} headers={headers} />
              <ColSelect label="Precio de venta" value={cols.price || ''} onChange={v => setCols(c => ({...c, price: v}))} headers={headers} />
              <ColSelect label="Costo unitario" value={cols.cost || ''} onChange={v => setCols(c => ({...c, cost: v}))} headers={headers} />
              <ColSelect label="Unidad de medida" value={cols.unit || ''} onChange={v => setCols(c => ({...c, unit: v}))} headers={headers} />
            </div>

            {/* Preview de primeras 3 filas */}
            <div style={{ background: '#f9f9f7', borderRadius: 8, padding: 12, fontSize: 11,
              fontFamily: 'monospace', color: '#6a6a68', overflow: 'auto', maxHeight: 100 }}>
              {rows.slice(0, 3).map((row, i) => (
                <div key={i}>{Object.values(row).slice(0, 6).join(' · ')}</div>
              ))}
              {rows.length > 3 && <div style={{ color: '#9a9a98' }}>... y {rows.length - 3} filas más</div>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={buildPreview} disabled={!cols.name}>Ver preview ({rows.length} productos)</Btn>
              <Btn variant="ghost" onClick={() => setStep('upload')}>← Cambiar archivo</Btn>
            </div>
          </div>
        )}

        {/* ── PASO 3: PREVIEW + CONFIRMAR ── */}
        {step === 'preview' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Total', value: preview.length, color: '#1a1a18' },
                { label: 'Nuevos', value: creates, color: G },
                { label: 'Actualizaciones', value: updates, color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: '#f9f9f7',
                  borderRadius: 10, border: '1px solid #f0ede8' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#9a9a98', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Modo */}
            {creates > 0 && updates > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[['both','Crear nuevos + actualizar existentes'],['create','Solo crear nuevos'],['update','Solo actualizar stock']].map(([v, l]) => (
                  <button key={v} onClick={() => setMode(v)}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${mode===v?G:'#e2e2de'}`,
                      background: mode===v?'#f0fdf4':'#fff', color: mode===v?G:'#6a6a68',
                      fontFamily: F.sans, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            {/* Tabla preview */}
            <div style={{ border: '1px solid #f0ede8', borderRadius: 10, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f7', position: 'sticky', top: 0 }}>
                    {['Acción','Nombre','Código','Stock','Precio','Unidad'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: F.sans,
                        fontSize: 10, fontWeight: 600, color: '#9a9a98', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f7',
                      background: item.action === 'create' ? '#ffffff' : '#fffbf0' }}>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                          background: item.action==='create'?'#f0fdf4':'#fef9c3',
                          color: item.action==='create'?G:'#b45309' }}>
                          {item.action==='create'?'Nuevo':'Actualizar'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 12px', fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{item.name}</td>
                      <td style={{ padding: '7px 12px', fontSize: 11, color: '#9a9a98', fontFamily: 'monospace' }}>{item.code || '—'}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: G }}>{item.stock}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: '#1a1a18' }}>{item.price > 0 ? `$${item.price}` : '—'}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: '#9a9a98' }}>{item.unit || 'u'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={apply}>
                Importar {mode==='both'?preview.length:mode==='create'?creates:updates} productos
              </Btn>
              <Btn variant="ghost" onClick={() => setStep('map')}>← Editar mapeo</Btn>
              <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

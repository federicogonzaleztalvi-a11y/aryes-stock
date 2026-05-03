/**
 * ClienteImporter — Importación masiva de clientes desde CSV.
 *
 * Columnas soportadas (case-insensitive, separador auto-detect , ; tab):
 *   nombre* | telefono | tipo | ciudad | email | rut | direccion | notas | lista
 *
 * El campo telefono es crítico — habilita el portal B2B con OTP.
 */
import { useState } from 'react';
import { db, getOrgId } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

const G = '#059669';

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'El archivo está vacío o solo tiene encabezados' };

  // Auto-detect separator
  const first = lines[0];
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';

  const headers = first.split(sep).map(h =>
    h.trim().toLowerCase()
      .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o')
      .replace(/[úùü]/g,'u')
      .replace(/ñ/g,'n')
      .replace(/[^a-z0-9]/g, '')
  );

  const rows = lines.slice(1).map((line, i) => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, j) => { obj[h] = vals[j] || ''; });

    // Map flexible column names → canonical fields
    const nombre   = obj.nombre || obj.name || obj.razon || obj.empresa || '';
    const telefono = (obj.telefono || obj.tel || obj.phone || obj.celular || obj.movil || '')
      .replace(/\D/g, '').slice(-9); // solo últimos 9 dígitos
    const tipo     = obj.tipo || obj.type || obj.categoria || obj.rubro || 'Panadería';
    const ciudad   = obj.ciudad || obj.city || obj.localidad || '';
    const email    = obj.email || obj.correo || obj.mail || '';
    const rut      = obj.rut || obj.ci || obj.nit || obj.documento || '';
    const direccion = obj.direccion || obj.dir || obj.address || '';
    const notas    = obj.notas || obj.nota || obj.obs || obj.observaciones || '';

    if (!nombre) return null; // skip empty rows

    return {
      _row:      i + 2, // 1-based, accounting for header
      nombre:    nombre.substring(0, 100),
      telefono,
      tipo:      tipo.substring(0, 50) || 'Panadería',
      ciudad:    ciudad.substring(0, 80),
      email:     email.substring(0, 120),
      rut:       rut.substring(0, 30),
      direccion: direccion.substring(0, 150),
      notas:     notas.substring(0, 200),
    };
  }).filter(Boolean);

  return { rows, error: null };
}

const TIPOS = ['Panadería', 'Heladería', 'HORECA', 'Confitería', 'Restaurante', 'Hotel', 'Pastelería', 'Otro'];

export default function ClienteImporter({ onClose, onImported }) {
  const { setClientes, clientes} = useApp();
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState([]);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null); // { imported, skipped }
  const [step,     setStep]     = useState('upload'); // upload | preview | done

  const readXlsx = async (file) => {
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
          res(window.XLSX.utils.sheet_to_csv(ws));
        } catch (err) { rej(err); }
      };
      reader.onerror = rej;
      reader.readAsBinaryString(file);
    });
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0] || e;
    if (!f) return;
    setFile(f);
    setError('');
    setLoading(true);
    try {
      let text = '';
      if (f.name?.toLowerCase().endsWith('.xlsx') || f.name?.toLowerCase().endsWith('.xls')) {
        text = await readXlsx(f);
      } else {
        text = await f.text();
      }
      const { rows, error: parseErr } = parseCSV(text);
      if (parseErr) { setError(parseErr); return; }
      if (rows.length === 0) { setError('No se encontraron filas con datos válidos'); return; }
      setPreview(rows);
      setStep('preview');
    } catch (err) {
      setError('Error al leer el archivo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true);
    const orgId = getOrgId();
    let imported = 0;
    let skipped  = 0;

    // Insert in batches of 50
    const BATCH = 50;
    for (let i = 0; i < preview.length; i += BATCH) {
      const batch = preview.slice(i, i + BATCH).map(row => ({
        id:               crypto.randomUUID(),
        org_id:           orgId,
        nombre:           row.nombre,
        telefono:         row.telefono,
        tipo:             row.tipo,
        ciudad:           row.ciudad,
        email:            row.email,
        rut:              row.rut,
        direccion:        row.direccion,
        notas:            row.notas,
        cond_pago:        'credito_30',
        limite_credito:   0,
        active:           true,
      }));

      try {
        const res = await db.insertMany('clients', batch);
        imported += batch.length;
      } catch (e) {
        console.warn('[ClienteImporter] batch error:', e.message);
        skipped += batch.length;
      }
    }

    // Refresh clientes en AppContext leyendo de Supabase
    try {
      const fresh = await db.get(`clients?org_id=eq.${orgId}&order=nombre.asc&limit=500`);
      if (Array.isArray(fresh)) setClientes(fresh);
    } catch { /* non-critical */ }

    setResult({ imported, skipped });
    setStep('done');
    setLoading(false);
    onImported?.(imported);
  };

  const inp = {
    padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
              📥 Importar clientes desde CSV
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Sube un archivo CSV con nombre, teléfono y tipo de cliente
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div>
              {/* Drop zone */}
              <label style={{ display: 'block', border: '2px dashed #d1d5db', borderRadius: 12,
                padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                background: '#fafafa', transition: 'border-color .2s' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
                <input type="file" accept=".csv,.xlsx,.xls,.txt" style={{ display: 'none' }} onChange={handleFile} />
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                  Arrastrá tu CSV acá o hacé click para seleccionar
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                  Formatos: .xlsx · .csv · .txt — Separadores auto-detectados
                </div>
              </label>

              {error && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Plantilla descargable */}
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4',
                borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: G, marginBottom: 4 }}>
                  ¿No tenés el archivo en el formato correcto?
                </div>
                <div style={{ fontSize: 11, color: '#6a6a68', marginBottom: 8 }}>
                  Descargá la plantilla y completala con tus clientes.
                </div>
                <button onClick={() => {
                  const csv = 'nombre;telefono;tipo;ciudad;email;rut;direccion\nPanadería Sol;099123456;Panadería;Montevideo;sol@mail.com;21234560001;Av. 18 de Julio 1234\nHeladería Norte;098765432;Heladería;Colonia;;;';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url;
                  a.download = 'plantilla-clientes-pazque.csv'; a.click();
                }}
                  style={{ background: G, color: '#fff', border: 'none', borderRadius: 6,
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Descargar plantilla CSV
                </button>
              </div>

              {/* Formato esperado */}
              <div style={{ marginTop: 16, padding: '16px 20px', background: '#f9fafb',
                borderRadius: 10, border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Formato del CSV
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151',
                  background: '#fff', padding: '10px 14px', borderRadius: 6,
                  border: '1px solid #e5e7eb', overflowX: 'auto' }}>
                  nombre;telefono;tipo;ciudad;email;rut<br/>
                  Panadería Sol;099123456;Panadería;Montevideo;sol@mail.com;21234560001<br/>
                  Heladería Norte;098765432;Heladería;Colonia;;
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
                  Solo <strong>nombre</strong> es obligatorio. <strong>telefono</strong> es necesario para el portal B2B.
                  Tipos válidos: {TIPOS.join(', ')}.
                </div>
              </div>
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                  {preview.length} clientes detectados
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {preview.filter(r => r.telefono).length} con teléfono (portal B2B)
                  · {preview.filter(r => !r.telefono).length} sin teléfono
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 360 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['#', 'Nombre', 'Teléfono', 'Tipo', 'Ciudad', 'Email'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                            fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 200).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '7px 12px', color: '#9ca3af' }}>{row._row}</td>
                          <td style={{ padding: '7px 12px', fontWeight: 500 }}>{row.nombre}</td>
                          <td style={{ padding: '7px 12px' }}>
                            {row.telefono
                              ? <span style={{ color: G, fontWeight: 600 }}>📱 {row.telefono}</span>
                              : <span style={{ color: '#f59e0b' }}>⚠ sin tel.</span>}
                          </td>
                          <td style={{ padding: '7px 12px' }}>{row.tipo}</td>
                          <td style={{ padding: '7px 12px' }}>{row.ciudad}</td>
                          <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 200 && (
                  <div style={{ padding: '8px 12px', background: '#f9fafb', fontSize: 12,
                    color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
                    Mostrando primeros 200 de {preview.length}. Se importarán todos.
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2',
                  borderRadius: 8, fontSize: 13, color: '#dc2626' }}>⚠️ {error}</div>
              )}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {result.skipped === 0 ? '✅' : '⚠️'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                {result.imported > 0
                  ? `${result.imported} clientes importados`
                  : 'No se pudo importar'}
              </div>
              {result.skipped > 0 && (
                <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 8 }}>
                  {result.skipped} filas no se pudieron guardar (pueden ya existir)
                </div>
              )}
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Los clientes con teléfono ya pueden usar el portal B2B
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {step === 'upload' && (
            <button onClick={onClose}
              style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setPreview([]); setError(''); }}
                style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                ← Volver
              </button>
              <button onClick={handleImport} disabled={loading}
                style={{ padding: '9px 24px', background: loading ? '#9ca3af' : G,
                  color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 700 }}>
                {loading ? 'Importando...' : `✓ Importar ${preview.length} clientes`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              style={{ padding: '9px 24px', background: G, color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

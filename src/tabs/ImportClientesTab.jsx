import { useState } from 'react';
import * as XLSX from 'xlsx';
import { db, getOrgId } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

const G = '#059669';

const COND_MAP = { contado:'contado', credito_15:'credito_15', credito_30:'credito_30', credito_60:'credito_60', credito_90:'credito_90', '15':'credito_15', '30':'credito_30', '60':'credito_60', '90':'credito_90' };

function norm(s) { return String(s||'').trim().toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/[^a-z0-9]/g,''); }

function rowToClient(raw, priceListas) {
  const o = {}; Object.keys(raw).forEach(k => { o[norm(k)] = String(raw[k]||'').trim(); });
  const nombre = o.nombre||o.name||o.razonsocial||o.cliente||'';
  if (!nombre) return null;
  const listaNombre = o.lista||o.listadeprecios||o.pricelist||'';
  let listaId = null;
  if (listaNombre && priceListas?.length) { const m = priceListas.find(l => norm(l.nombre)===norm(listaNombre)); if (m) listaId = m.id; }
  const condRaw = o.condpago||o.condicionpago||o.cond||'';
  const condPago = COND_MAP[norm(condRaw)] || COND_MAP[condRaw] || 'credito_30';
  let tel = String(o.telefono||o.phone||o.tel||o.celular||'').replace(/\D/g,'');
  if (tel.startsWith('598')) tel = tel.slice(3);
  if (tel.startsWith('0')) tel = tel.slice(1);
  return {
    id: crypto.randomUUID(), nombre, telefono: tel,
    rut: o.rut||o.cuit||o.nit||'', tipo: o.tipo||o.type||o.rubro||'Otro',
    direccion: o.direccion||o.address||o.domicilio||'', ciudad: o.ciudad||o.city||'',
    zonaEntrega: o.zona||o.zonaentrega||o.zone||'', condPago,
    limiteCredito: Number(o.limitecredito||o.limite||o.credit||0)||null,
    email: o.email||'', emailFacturacion: o.emailfacturacion||o.emailfact||'',
    contacto: o.contacto||o.contact||'', listaId,
    horarioDesde: o.horariodesde||o.desde||'', horarioHasta: o.horariohasta||o.hasta||'',
    notas: o.notas||o.notes||o.observaciones||'', codigo: o.codigo||o.code||'',
  };
}

export default function ImportClientesTab() {
  const { priceListas, clientes: existingClientes, setClientes } = useApp();
  const [preview, setPreview] = useState([]);
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [dups, setDups] = useState([]);

  const parseFile = (buf) => {
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: 3 });
    return rows.map(r => rowToClient(r, priceListas)).filter(Boolean);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setMsg(''); setPreview([]); setDups([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseFile(ev.target.result);
        if (!parsed.length) { setMsg('No se encontraron clientes. Verificá que el archivo tenga datos desde la fila 4.'); return; }
        const d = parsed.filter(c => c.telefono && existingClientes?.find(ex => ex.telefono === c.telefono)).map(c => c.telefono);
        setDups(d); setPreview(parsed);
        setMsg(parsed.length + ' cliente' + (parsed.length!==1?'s':'') + ' encontrado' + (parsed.length!==1?'s':'') + (d.length ? ' · ' + d.length + ' teléfono' + (d.length!==1?'s':'') + ' ya existe' + (d.length===1?'':'n') : ''));
      } catch(err) { setMsg('Error al leer el archivo: ' + err.message); }
    };
    reader.readAsArrayBuffer(file); e.target.value = '';
  };

  const importar = async () => {
    if (!preview.length) return;
    setImporting(true); setMsg('Importando...');
    let ok = 0, fail = 0;
    for (const c of preview) {
      try {
        await db.upsert('clients', {
          id: c.id, name: c.nombre, type: c.tipo||'Otro', rut: c.rut||'', phone: c.telefono||'',
          email: c.email||'', email_facturacion: c.emailFacturacion||'', contact: c.contacto||'',
          address: c.direccion||'', ciudad: c.ciudad||'', cond_pago: c.condPago||'credito_30',
          limite_credito: c.limiteCredito||null, lista_id: c.listaId||null, codigo: c.codigo||null,
          horario_desde: c.horarioDesde||null, horario_hasta: c.horarioHasta||null,
          zona_entrega: c.zonaEntrega||'', notes: c.notas||'',
          org_id: getOrgId(), created_at: new Date().toISOString(),
        }, 'id');
        ok++;
      } catch(e) { console.error('[ImportClientes]', c.nombre, e.message); fail++; }
    }
    setMsg(ok + ' cliente' + (ok!==1?'s':'') + ' importado' + (ok!==1?'s':'') + (fail ? ' · ' + fail + ' con error' : ''));
    setPreview([]); setImporting(false);
    try {
      const data = await db.get('clients?org_id=eq.' + getOrgId() + '&order=created_at.asc&limit=2000');
      if (data) setClientes(data.map(c => ({ id:c.id, nombre:c.name, tipo:c.type, rut:c.rut||'', telefono:c.phone||'', email:c.email||'', emailFacturacion:c.email_facturacion||'', contacto:c.contact||'', direccion:c.address||'', ciudad:c.ciudad||'', condPago:c.cond_pago||'credito_30', limiteCredito:c.limite_credito||'', listaId:c.lista_id||'', codigo:c.codigo||'', horarioDesde:c.horario_desde||'', horarioHasta:c.horario_hasta||'', zonaEntrega:c.zona_entrega||'', notas:c.notes||'' })));
    } catch(e) {}
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>Importar clientes</h2>
      <p style={{ fontSize: 13, color: '#6a6a68', marginBottom: 28 }}>Cargá hasta 500 clientes a la vez desde un archivo Excel.</p>

      <div style={{ background: '#f9f9f7', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5, marginBottom: 8 }}>PASO 1 — DESCARGÁ LA PLANTILLA</div>
        <p style={{ fontSize: 13, color: '#4b4b48', margin: '0 0 14px' }}>Completá la plantilla con tus clientes. La fila 3 (gris) es un ejemplo que podés borrar. Guardala como <strong>.xlsx</strong>.</p>
        <a href="/Pazque_plantilla_clientes.xlsx" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: G, color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          ⬇ Descargar plantilla clientes (.xlsx)
        </a>
      </div>

      <div style={{ background: '#f9f9f7', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5, marginBottom: 8 }}>PASO 2 — SUBÍ TU ARCHIVO</div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#fff', border: '1px solid ' + G, color: G, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          📂 Elegir archivo Excel (.xlsx / .xls)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.includes('importado') ? G : msg.includes('error')||msg.includes('Error') ? '#dc2626' : '#4b4b48', fontWeight: 500 }}>{msg}</div>}
      </div>

      {preview.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5, marginBottom: 12 }}>PASO 3 — REVISÁ Y CONFIRMÁ</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f4f4f0' }}>
                {['Nombre','Teléfono','RUT','Tipo','Lista','CondPago','Ciudad','Estado'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#4b4b48', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {preview.slice(0,25).map((c, i) => {
                  const isDup = dups.includes(c.telefono);
                  const listaName = priceListas?.find(l => l.id===c.listaId)?.nombre || (c.listaId ? '⚠ No encontrada' : '—');
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0ed', background: isDup ? '#fef3c7' : i%2===0 ? '#fff' : '#fafaf8' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1a1a18' }}>{c.nombre}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{c.telefono||'—'}</td>
                      <td style={{ padding: '7px 10px' }}>{c.rut||'—'}</td>
                      <td style={{ padding: '7px 10px' }}>{c.tipo}</td>
                      <td style={{ padding: '7px 10px', color: c.listaId ? G : '#9a9a98', fontWeight: c.listaId?600:400 }}>{listaName}</td>
                      <td style={{ padding: '7px 10px' }}>{c.condPago}</td>
                      <td style={{ padding: '7px 10px' }}>{c.ciudad||'—'}</td>
                      <td style={{ padding: '7px 10px' }}>
                        {isDup
                          ? <span style={{ background: '#fde68a', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>⚠ Tel. duplicado</span>
                          : <span style={{ background: '#d1fae5', color: G, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>✓ Nuevo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.length > 25 && <div style={{ fontSize: 12, color: '#9a9a98', padding: '8px 0', textAlign: 'center' }}>Mostrando 25 de {preview.length}. Todos van a importarse.</div>}
          </div>
          {dups.length > 0 && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>⚠ Los clientes con teléfono duplicado van a actualizar los datos del cliente existente. Eliminá esas filas del Excel si no querés actualizarlos.</div>}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button onClick={importar} disabled={importing} style={{ padding: '10px 24px', background: importing ? '#9a9a98' : G, color: '#fff', border: 'none', borderRadius: 8, cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
              {importing ? 'Importando...' : 'Importar ' + preview.length + ' cliente' + (preview.length!==1?'s':'')}
            </button>
            <button onClick={() => { setPreview([]); setMsg(''); setDups([]); }} style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6a6a68' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 10, padding: '14px 18px', fontSize: 12, color: '#065f46' }}>
        <strong>Tips:</strong> La columna <strong>Lista</strong> tiene que coincidir exactamente con el nombre en Pazque (ej: "Minorista", "HORECA"). El <strong>Teléfono</strong> va sin 0 ni 598 adelante. Los descuentos especiales por producto se cargan desde la ficha individual de cada cliente.
      </div>
    </div>
  );
}

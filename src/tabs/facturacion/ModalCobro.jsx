// ── ModalCobro — Registrar cobro + Recibo imprimible ──────────────────────────
// Abre un modal para registrar un pago de cliente contra CFEs pendientes.
// Al guardar, ofrece un recibo HTML imprimible y botón de WhatsApp.
// Puede ser prefillado con clienteId, clienteNombre, monto y facturas.

import { useState, useMemo } from 'react';
import { G, F, fmtMoney, fmtDateShort } from './constants.js';

const METODOS = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro'];

// ── Recibo HTML (string) para imprimir / compartir ───────────────────────────
function buildReciboHtml({ cobro, cliente, facturas, empresa }) {
  const lineaFacturas = facturas.length > 0
    ? facturas.map(f =>
        `<tr>
          <td style="padding:4px 8px;font-size:12px;border-bottom:1px solid #f0f0ec">${f.numero} (${f.tipo||''})</td>
          <td style="padding:4px 8px;font-size:12px;text-align:right;border-bottom:1px solid #f0f0ec">${fmtMoney(f.total, f.moneda)}</td>
        </tr>`
      ).join('')
    : '<tr><td colspan="2" style="padding:4px 8px;font-size:12px;color:#888">Cobro a cuenta</td></tr>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Cobro — ${cobro.nroRecibo}</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: #fff; }
    .recibo { max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px; }
    h1 { font-size: 22px; color: ${G}; margin: 0 0 4px; }
    .sub { font-size: 12px; color: #888; margin: 0 0 20px; }
    .divider { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
    .label { color: #6b7280; }
    .value { font-weight: 600; }
    .total { font-size: 20px; color: ${G}; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { font-size: 10px; text-transform: uppercase; color: #9ca3af; padding: 4px 8px; text-align: left; background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="recibo">
    <h1>${empresa?.nombre || 'Aryes'}</h1>
    <p class="sub">${empresa?.direccion || ''} — ${empresa?.telefono || ''}</p>
    <hr class="divider">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Recibo de Cobro</div>
      <div style="font-size:22px;font-weight:800;color:${G};margin:4px 0">${cobro.nroRecibo}</div>
    </div>
    <div class="row"><span class="label">Cliente</span><span class="value">${cliente?.nombre || cobro.clienteNombre || '—'}</span></div>
    <div class="row"><span class="label">RUT</span><span class="value">${cliente?.rut || '—'}</span></div>
    <div class="row"><span class="label">Fecha</span><span class="value">${cobro.fecha}</span></div>
    <div class="row"><span class="label">Método</span><span class="value">${cobro.metodo}</span></div>
    ${cobro.fechaCheque ? `<div class="row"><span class="label">Depósito cheque</span><span class="value">${cobro.fechaCheque}</span></div>` : ''}
    <hr class="divider">
    ${facturas.length > 0 ? `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:.05em;margin-bottom:8px">Comprobantes cancelados</div>
    <table><thead><tr><th>Nro / Tipo</th><th style="text-align:right">Importe</th></tr></thead><tbody>${lineaFacturas}</tbody></table>
    <hr class="divider">` : ''}
    <div class="row" style="margin-top:8px">
      <span style="font-size:16px;font-weight:700">TOTAL COBRADO</span>
      <span class="total">${fmtMoney(cobro.monto)}</span>
    </div>
    ${cobro.notas ? `<p style="font-size:12px;color:#6b7280;margin-top:12px">Notas: ${cobro.notas}</p>` : ''}
    <p class="footer">Documento no fiscal · Comprobante interno de cobro<br>${new Date().toLocaleString('es-UY')}</p>
  </div>
  <div class="no-print" style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:${G};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨 Imprimir recibo</button>
  </div>
</body>
</html>`;
}

// ── Recibo Modal (post-cobro) ─────────────────────────────────────────────────
function ReciboModal({ cobro, cliente, facturas, empresa, onClose }) {
  const html = buildReciboHtml({ cobro, cliente, facturas, empresa });

  const abrirImpresion = () => {
    const w = window.open('', '_blank', 'width=540,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const compartirWhatsApp = () => {
    const facturasList = facturas.length > 0
      ? facturas.map(f => `  • ${f.numero}`).join('\n')
      : '  • Cobro a cuenta';
    const msg = [
      `*Recibo de Cobro ${cobro.nroRecibo}*`,
      `Cliente: ${cliente?.nombre || cobro.clienteNombre || '—'}`,
      `Fecha: ${cobro.fecha}`,
      `Método: ${cobro.metodo}`,
      '',
      'Comprobantes:',
      facturasList,
      '',
      `*Total cobrado: ${fmtMoney(cobro.monto)}*`,
      cobro.notas ? `Notas: ${cobro.notas}` : '',
    ].filter(Boolean).join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:460, width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:F.serif, fontSize:20, fontWeight:700, color:'#1a1a1a' }}>
              Cobro registrado ✓
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{cobro.nroRecibo}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'#6b7280' }}>×</button>
        </div>

        {/* Summary */}
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10,
          padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, color:'#374151' }}>{cliente?.nombre || cobro.clienteNombre}</span>
            <span style={{ fontFamily:F.mono, fontSize:22, fontWeight:800, color:G }}>
              {fmtMoney(cobro.monto)}
            </span>
          </div>
          <div style={{ fontSize:12, color:'#6b7280' }}>
            {cobro.metodo} · {cobro.fecha}
            {facturas.length > 0 && ` · ${facturas.length} factura${facturas.length>1?'s':''} cancelada${facturas.length>1?'s':''}`}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={abrirImpresion}
            style={{ padding:'11px 0', background:'#fff', border:`2px solid ${G}`, borderRadius:10,
              color:G, fontWeight:700, fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🖨 Imprimir / guardar PDF
          </button>
          <button onClick={compartirWhatsApp}
            style={{ padding:'11px 0', background:'#25d366', border:'none', borderRadius:10,
              color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            💬 Compartir por WhatsApp
          </button>
          <button onClick={onClose}
            style={{ padding:'9px 0', background:'#f9fafb', border:'1px solid #e5e7eb',
              borderRadius:10, color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalCobro principal ──────────────────────────────────────────────────────
export default function ModalCobro({ clientes, cfes, onSave, onClose, prefillClienteId, prefillMonto, prefillFacturas, empresa }) {
  const hoy = new Date().toISOString().slice(0, 10);

  const [clienteId,    setClienteId]    = useState(prefillClienteId || '');
  const [monto,        setMonto]        = useState(prefillMonto ? String(prefillMonto) : '');
  const [metodo,       setMetodo]       = useState('Efectivo');
  const [fecha,        setFecha]        = useState(hoy);
  const [fechaCheque,  setFechaCheque]  = useState('');
  const [notas,        setNotas]        = useState('');
  const [selFacturas,  setSelFacturas]  = useState(prefillFacturas || []);
  const [error,        setError]        = useState('');
  const [cobroGuardado,setCobroGuardado] = useState(null);

  const cliente = clientes.find(c => c.id === clienteId) || null;

  // CFEs pendientes del cliente seleccionado
  const cfesPendientes = useMemo(() =>
    cfes.filter(c =>
      c.clienteId === clienteId &&
      ['emitida', 'cobrado_parcial'].includes(c.status) &&
      (c.saldoPendiente || c.total) > 0
    ).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)),
    [cfes, clienteId]
  );

  // Saldo deudor total del cliente
  const saldoTotal = cfesPendientes.reduce((s, c) => s + (c.saldoPendiente || c.total || 0), 0);

  // Total de las facturas seleccionadas
  const totalSeleccionado = cfesPendientes
    .filter(c => selFacturas.includes(c.id))
    .reduce((s, c) => s + (c.saldoPendiente || c.total || 0), 0);

  const seleccionarTodo = () => setSelFacturas(cfesPendientes.map(c => c.id));
  const deseleccionarTodo = () => setSelFacturas([]);

  // Al cambiar selección de facturas, actualiza el monto automáticamente
  const onToggleFactura = (id) => {
    const newSel = selFacturas.includes(id) ? selFacturas.filter(x => x !== id) : [...selFacturas, id];
    setSelFacturas(newSel);
    const newTotal = cfesPendientes
      .filter(c => newSel.includes(c.id))
      .reduce((s, c) => s + (c.saldoPendiente || c.total || 0), 0);
    if (newTotal > 0) setMonto(String(newTotal.toFixed(2)));
  };

  const guardar = () => {
    if (!clienteId)                  { setError('Seleccioná un cliente'); return; }
    if (!monto || Number(monto) <= 0) { setError('Ingresá un monto válido'); return; }
    if (!fecha)                      { setError('Ingresá la fecha'); return; }

    const nroRecibo = 'REC-' + new Date().getFullYear() +
      '-' + String(Date.now()).slice(-6);

    const cobro = {
      nroRecibo,
      clienteId,
      clienteNombre: cliente?.nombre || '',
      monto:         Number(monto),
      metodo,
      fecha,
      fechaCheque:   metodo === 'Cheque' ? fechaCheque : null,
      notas,
      facturasAplicar: selFacturas,
    };

    onSave(cobro);
    setCobroGuardado(cobro);
    setError('');
  };

  const facturasDeCobro = cfesPendientes.filter(c => selFacturas.includes(c.id));

  const inp = {
    padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff',
  };

  // Post-guardar: mostrar recibo
  if (cobroGuardado) return (
    <ReciboModal
      cobro={cobroGuardado}
      cliente={cliente}
      facturas={facturasDeCobro}
      empresa={empresa}
      onClose={onClose}
    />
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:540, width:'100%',
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontFamily:F.serif, fontSize:22, margin:0 }}>Registrar cobro</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'#6b7280' }}>×</button>
        </div>

        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8,
            padding:'9px 14px', marginBottom:14, color:'#dc2626', fontSize:13 }}>{error}</div>
        )}

        {/* Cliente */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
            letterSpacing:.5, display:'block', marginBottom:4 }}>Cliente *</label>
          <select value={clienteId} onChange={e => { setClienteId(e.target.value); setSelFacturas([]); setMonto(''); }}
            style={inp}>
            <option value="">— Seleccioná un cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Saldo deudor */}
        {clienteId && (
          <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 14px',
            marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>Saldo deudor total</span>
            <span style={{ fontFamily:F.mono, fontSize:16, fontWeight:700,
              color: saldoTotal > 0 ? '#dc2626' : G }}>
              {fmtMoney(saldoTotal)}
            </span>
          </div>
        )}

        {/* Facturas pendientes */}
        {cfesPendientes.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5 }}>
                Facturas a cancelar
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={seleccionarTodo} style={{ fontSize:11, color:G, background:'none',
                  border:'none', cursor:'pointer', fontWeight:600 }}>Todas</button>
                <button onClick={deseleccionarTodo} style={{ fontSize:11, color:'#9ca3af', background:'none',
                  border:'none', cursor:'pointer' }}>Ninguna</button>
              </div>
            </div>
            <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
              {cfesPendientes.map((cfe, i) => {
                const checked = selFacturas.includes(cfe.id);
                return (
                  <label key={cfe.id} style={{ display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', cursor:'pointer',
                    background: checked ? '#f0fdf4' : i%2===0 ? '#fff' : '#fafafa',
                    borderBottom: i < cfesPendientes.length-1 ? '1px solid #f3f4f6' : 'none',
                    borderLeft: checked ? `3px solid ${G}` : '3px solid transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => onToggleFactura(cfe.id)}
                      style={{ accentColor:G, width:15, height:15, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontFamily:F.mono, fontWeight:600, color:'#374151' }}>
                        {cfe.numero}
                        <span style={{ marginLeft:6, fontSize:10, color:'#9ca3af', fontFamily:'inherit',
                          fontWeight:400 }}>{cfe.tipo}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{fmtDateShort(cfe.fecha)}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontFamily:F.mono, fontSize:13, fontWeight:700,
                        color: checked ? G : '#374151' }}>
                        {fmtMoney(cfe.saldoPendiente || cfe.total, cfe.moneda)}
                      </div>
                      {cfe.saldoPendiente < cfe.total && (
                        <div style={{ fontSize:10, color:'#9ca3af' }}>
                          de {fmtMoney(cfe.total, cfe.moneda)}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {selFacturas.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', fontSize:12,
                color:G, fontWeight:700, padding:'6px 2px' }}>
                Seleccionado: {fmtMoney(totalSeleccionado)}
              </div>
            )}
          </div>
        )}

        {/* Monto, método, fecha */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
              letterSpacing:.5, display:'block', marginBottom:4 }}>Monto *</label>
            <input type="number" min="0" step="0.01" value={monto}
              onChange={e => setMonto(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
              letterSpacing:.5, display:'block', marginBottom:4 }}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
            letterSpacing:.5, display:'block', marginBottom:4 }}>Método de pago *</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {METODOS.map(m => (
              <button key={m} onClick={() => setMetodo(m)} style={{
                padding:'6px 14px', borderRadius:20, border:'1px solid',
                borderColor: metodo === m ? G : '#e5e7eb',
                background: metodo === m ? G : '#fff',
                color: metodo === m ? '#fff' : '#374151',
                fontSize:12, fontWeight:600, cursor:'pointer',
              }}>{m}</button>
            ))}
          </div>
        </div>

        {metodo === 'Cheque' && (
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
              letterSpacing:.5, display:'block', marginBottom:4 }}>Fecha de depósito del cheque</label>
            <input type="date" value={fechaCheque} onChange={e => setFechaCheque(e.target.value)} style={inp} />
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase',
            letterSpacing:.5, display:'block', marginBottom:4 }}>Notas</label>
          <input value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones opcionales..." style={inp} />
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'10px 20px', border:'1px solid #e5e7eb',
            borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={guardar} style={{ padding:'10px 28px', background:G, color:'#fff',
            border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:14 }}>
            Registrar cobro
          </button>
        </div>
      </div>
    </div>
  );
}

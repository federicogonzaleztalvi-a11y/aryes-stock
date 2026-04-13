import React, { useState, useMemo, useEffect } from 'react';
import EstadoCuentaPDF from '../components/EstadoCuentaPDF.jsx';
import { useApp } from '../context/AppContext.tsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { LS, db } from '../lib/constants.js';
import ModalFactura from './facturacion/ModalFactura.jsx';
import FacturaPDF from '../components/FacturaPDF.jsx';
import ModalCobro from './facturacion/ModalCobro.jsx';
import { getOrgId } from '../lib/constants.js';
import { G, F, CFE_TIPOS, CFE_STATUS, COND_PAGO, newId, fmtMoney, fmtDateShort, daysUntil, agingBucket } from './facturacion/constants.js';
const fmt = { currency: fmtMoney };
import { Pill, TabBtn, KpiCard, Lbl, Sel } from './facturacion/components.jsx';

function FacturacionTab({ products=[] }) {
  const { cfes, setCfes, cobros, setCobros, clientes } = useApp();
  // Sync error banner: shown when a DB write fails but local state is safe
  const [syncErr, setSyncErr] = useState('');
  const clearSyncErr = () => setSyncErr('');
  const notifyDbErr = (op, e) => {
    console.warn('[FacturacionTab]', op, 'failed:', e?.message||e);
    setSyncErr('⚠ ' + op + ' no se sincronizó con el servidor. Los datos están guardados localmente y se sincronizarán al reconectar.');
    setTimeout(clearSyncErr, 8000);
  };
  const KSEQ  = 'aryes-cfe-seq';

  const { confirm, ConfirmDialog: _ConfirmDialog } = useConfirm();
  // clientes now from useApp() — reactive and always current
  const [seq, setSeq] = useState(1);
  // Cargar seq desde Supabase al arrancar
  useEffect(()=>{
    const SB=import.meta.env.VITE_SUPABASE_URL;
    const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${SB}/rest/v1/app_config?key=eq.cfe_seq_${getOrgId()}&select=value&limit=1`,
      {headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}})
      .then(r=>r.json()).then(d=>{if(d?.[0]?.value)setSeq(Number(d[0].value)||1);})
      .catch(()=>{});
  },[]);

  const [vista,   setVista]   = useState('comprobantes');
  const [pdfCfe, setPdfCfe] = useState(null);
  const [showCFE, setShowCFE] = useState(false);
  const [showCob, setShowCob] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCli,    setFiltroCli]    = useState('todos');
  const [showEstadoCuenta, setShowEstadoCuenta] = useState(false);
  const [busq,         setBusq]         = useState('');
  const [detalleCli,   setDetalleCli]   = useState(null);


  // ── Emitir CFE ────────────────────────────────────────────────────────
  const handleSaveCFE = form => {
    const code   = CFE_TIPOS[form.tipo]?.code||'CFE';
    const numero = `${code}-${String(seq).padStart(6,'0')}`;
    const nuevo  = { ...form, id:newId(), numero,
      saldoPendiente: form.total,
      createdAt: new Date().toISOString() };
    setCfes([nuevo,...cfes]);
    setSeq(s=>{
      const n=s+1;
      const SB=import.meta.env.VITE_SUPABASE_URL;
      const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
      fetch(`${SB}/rest/v1/app_config`,{method:'POST',
        headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({key:`cfe_seq_${getOrgId()}`,value:String(n),org_id:getOrgId()})
      }).catch(()=>{});
      return n;
    });
    setShowCFE(false); setPrefill(null);
    // → invoices table (source of truth)
    db.upsert('invoices', {
      id:              nuevo.id,
      numero,
      tipo:            nuevo.tipo,
      moneda:          nuevo.moneda,
      fecha:           nuevo.fecha,
      fecha_venc:      nuevo.fechaVenc    || null,
      cliente_id:      nuevo.clienteId    || null,
      cliente_nombre:  nuevo.clienteNombre,
      cliente_rut:     nuevo.clienteRut   || '',
      subtotal:        nuevo.subtotal     || 0,
      iva_total:       nuevo.ivaTotal     || 0,
      descuento:       nuevo.descuento    || 0,
      total:           nuevo.total,
      saldo_pendiente: nuevo.total,
      status:          nuevo.status,
      items:           nuevo.items,
      notas:           nuevo.notas        || '',
      created_at:      nuevo.createdAt,
    }, 'id').catch(e=>notifyDbErr('Factura', e));
    // → ventas table (legacy, kept for backwards compat)
    db.upsert('ventas',{ id:nuevo.id, numero, tipo:nuevo.tipo,
      cliente_id:nuevo.clienteId||null, cliente_nombre:nuevo.clienteNombre,
      cliente_rut:nuevo.clienteRut||'', total:nuevo.total, moneda:nuevo.moneda,
      fecha:nuevo.fecha, fecha_venc:nuevo.fechaVenc||null,
      status:nuevo.status, items:nuevo.items, notas:nuevo.notas,
      created_at:nuevo.createdAt
    }).catch(e=>notifyDbErr('Factura (ventas)', e));
  };

  // ── Registrar cobro ────────────────────────────────────────────────────
  const handleSaveCobro = ({ clienteId, monto, metodo, fecha, fechaCheque, notas, facturasAplicar }) => {
    const cobro = { id:newId(), clienteId, monto, metodo, fecha, fechaCheque, notas,
      facturasAplicar, createdAt:new Date().toISOString() };
    setCobros([cobro,...cobros]);

    // → collections table (non-blocking)
    db.upsert('collections', {
      id:               cobro.id,
      cliente_id:       clienteId  || null,
      monto:            monto,
      metodo:           metodo,
      fecha:            fecha,
      fecha_cheque:     fechaCheque || null,
      facturas_aplicar: facturasAplicar,
      notas:            notas       || '',
      created_at:       cobro.createdAt,
    }, 'id').catch(e=>notifyDbErr('Factura', e));

    // Update saldo pendiente en cada CFE aplicado
    let remaining = monto;
    const updCfes = cfes.map(c => {
      if (!facturasAplicar.includes(c.id) || remaining<=0) return c;
      const saldo  = c.saldoPendiente||c.total||0;
      const aplicar= Math.min(saldo, remaining);
      remaining   -= aplicar;
      const newSaldo = saldo - aplicar;
      const newStatus = newSaldo<=0.01 ? 'cobrada' : 'cobrado_parcial';
      // → update invoice in DB too
      db.patch('invoices',
        { saldo_pendiente: newSaldo, status: newStatus },
        { id: c.id }
      ).catch(e=>notifyDbErr('CFE actualización', e));
      return { ...c, saldoPendiente: newSaldo, status: newStatus };
    });
    setCfes(updCfes);
    setShowCob(false);
  };

  const anular = async id => {
    const ok = await confirm({ title:'¿Anular este CFE?', description:'El comprobante quedará marcado como anulado.', variant:'warning', confirmLabel:'Anular' });
    if (!ok) return;
    setCfes(cfes.map(c=>c.id===id ? {...c,status:'anulada'} : c));
    db.patch('invoices', { status:'anulada' }, { id }).catch(e=>notifyDbErr('Factura (ventas)', e));
  };

  // ── Computed ──────────────────────────────────────────────────────────
  const cfesFiltrados = useMemo(()=>cfes.filter(c=>{
    if (filtroStatus!=='todos'&&c.status!==filtroStatus) return false;
    if (filtroCli!=='todos'&&c.clienteId!==filtroCli) return false;
    if (busq) { const q=busq.toLowerCase();
      return (c.numero||'').toLowerCase().includes(q)||(c.clienteNombre||'').toLowerCase().includes(q); }
    return true;
  }),[cfes,filtroStatus,filtroCli,busq]);

  // Deudores: CFEs emitidas/parciales con saldo
  const deudores = useMemo(()=>{
    const map = {};
    cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&(c.saldoPendiente||c.total)>0)
      .forEach(c=>{
        if (!map[c.clienteId]) map[c.clienteId]={
          clienteId:c.clienteId, nombre:c.clienteNombre, facturas:[], totalDeuda:0, diasMaxVenc:0
        };
        const dias = c.fechaVenc ? Math.max(0,-daysUntil(c.fechaVenc)) : 0;
        map[c.clienteId].facturas.push(c);
        map[c.clienteId].totalDeuda += (c.saldoPendiente||c.total||0);
        if (dias > map[c.clienteId].diasMaxVenc) map[c.clienteId].diasMaxVenc = dias;
      });
    return Object.values(map).sort((a,b)=>b.diasMaxVenc-a.diasMaxVenc);
  },[cfes]);

  const totalDeuda    = deudores.reduce((s,d)=>s+d.totalDeuda,0);
  const vencidasHoy   = cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc&&daysUntil(c.fechaVenc)<0);
  const venceEsta     = cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc&&daysUntil(c.fechaVenc)>=0&&daysUntil(c.fechaVenc)<=7);
  const totalEmitido  = cfes.filter(c=>['emitida','aceptada','cobrada'].includes(c.status)).reduce((s,c)=>s+c.total,0);

  const clienteDetalle = detalleCli ? clientes.find(c=>c.id===detalleCli)||{id:detalleCli,nombre:'Cliente'} : null;
  const cfesCliente    = detalleCli ? cfes.filter(c=>c.clienteId===detalleCli) : [];
  const cobrosCliente  = detalleCli ? cobros.filter(c=>c.clienteId===detalleCli) : [];

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="au" style={{ maxWidth:1200 }}>
      {syncErr&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'10px 16px',margin:'0 0 16px',color:'#92400e',fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>{syncErr}</span>
        <button onClick={clearSyncErr} style={{background:'none',border:'none',cursor:'pointer',color:'#92400e',fontSize:16,padding:'0 4px'}}>×</button>
      </div>}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@400;500&display=swap" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
        marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <Lbl>Facturación electrónica · Cuentas corrientes</Lbl>
          <h1 style={{ fontFamily:F.serif, fontSize:38, fontWeight:400, color:'#1a1a18',
            margin:0, letterSpacing:'-.02em', lineHeight:1 }}>Facturación</h1>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>setShowCob(true)} style={{ background:'#fff', color:G,
            border:`1.5px solid ${G}`, borderRadius:10, padding:'10px 20px',
            fontFamily:F.sans, fontSize:13, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6 }}>
            💰 Registrar cobro
          </button>
          <button onClick={()=>{setPrefill(null);setShowCFE(true);}} style={{
            background:G, color:'#fff', border:'none', borderRadius:10,
            padding:'10px 24px', fontFamily:F.sans, fontSize:13, fontWeight:600,
            cursor:'pointer', display:'flex', alignItems:'center', gap:8,
            boxShadow:'0 2px 8px rgba(58,125,30,.3)',
          }}>+ Nuevo CFE</button>
        </div>
      </div>

      {/* ── Alerta proveedor DGI ───────────────────────────────────── */}
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10,
        padding:'12px 18px', display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
        <span style={{ fontSize:18 }}>🔗</span>
        <div style={{ flex:1, fontFamily:F.sans, fontSize:13 }}>
          <b style={{ color:'#1e40af' }}>Proveedor habilitado DGI no configurado — </b>
          <span style={{ color:'#3b82f6' }}>CFEs guardados localmente. Cuando confirmes UCFE o pymo, se enviarán automáticamente.</span>
        </div>
        <span onClick={() => { window.dispatchEvent(new CustomEvent('pazque-nav', { detail: { tab: 'config', sub: 'facturacion_cfg' } })); }}
          style={{ background:'#dbeafe', color:'#2563eb', fontFamily:F.sans, fontSize:11,
          fontWeight:700, padding:'4px 12px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap' }}>
          Configurar →
        </span>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
        background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
        <KpiCard label="Deuda total" value={totalDeuda>0?fmt.currency(totalDeuda):'—'}
          sub={`${deudores.length} clientes con saldo`} accent={totalDeuda>0?'#dc2626':'#e2e2de'} danger />
        <KpiCard label="Facturas vencidas" value={vencidasHoy.length}
          sub="sin cobrar" accent={vencidasHoy.length>0?'#dc2626':'#e2e2de'} danger
          onClick={()=>{setVista('informes');}} />
        <KpiCard label="Vencen esta semana" value={venceEsta.length}
          sub="próximos 7 días" accent={venceEsta.length>0?'#d97706':'#e2e2de'} />
        <KpiCard label="Emitido total" value={totalEmitido>0?fmt.currency(totalEmitido):'—'}
          sub={`${cfes.filter(c=>c.status==='cobrada').length} cobradas`} accent={G} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div style={{ borderBottom:'1px solid #e2e2de', marginBottom:22, display:'flex', gap:0 }}>
        {[
          ['comprobantes','🧾 Comprobantes'],
          ['cuenta',      '📊 Cuenta corriente'],
          ['cobros',      '💰 Cobros'],
          ['informes',    '📋 Informes'],
        ].map(([v,l])=>
          <TabBtn key={v} active={vista===v} onClick={()=>setVista(v)}>{l}</TabBtn>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          VISTA: COMPROBANTES
      ══════════════════════════════════════════════════════════════ */}
      {vista==='comprobantes' && (
        <div>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="Buscar por número o cliente..."
              style={{ flex:1, minWidth:200, padding:'8px 14px 8px 36px', border:'1.5px solid #e2e2de',
                borderRadius:8, fontFamily:F.sans, fontSize:13, outline:'none',
                backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a9a98' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")",
                backgroundRepeat:'no-repeat', backgroundPosition:'12px center' }} />
            <Sel value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} style={{ width:180 }}>
              <option value="todos">Todos los clientes</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Sel>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['todos',...Object.keys(CFE_STATUS)].map(s=>(
                <button key={s} onClick={()=>setFiltroStatus(s)} style={{
                  padding:'6px 14px', borderRadius:20, fontFamily:F.sans, fontSize:12,
                  fontWeight:filtroStatus===s?700:500, cursor:'pointer',
                  border:`1.5px solid ${filtroStatus===s?G:'#e2e2de'}`,
                  background:filtroStatus===s?'#f0f7ec':'#fff',
                  color:filtroStatus===s?G:'#6a6a68', transition:'all .12s',
                }}>
                  {s==='todos'?'Todos':CFE_STATUS[s].label}
                </button>
              ))}
            </div>
          </div>

          {cfesFiltrados.length===0 ? (
            <div style={{ textAlign:'center', padding:'60px 40px', background:'#fff',
              borderRadius:12, border:'1px solid #e2e2de' }}>
              <div style={{ fontSize:48, marginBottom:14, opacity:.5 }}>🧾</div>
              <div style={{ fontFamily:F.serif, fontSize:26, color:'#1a1a18', marginBottom:8 }}>Sin comprobantes aún</div>
              <div style={{ fontFamily:F.sans, fontSize:14, color:'#9a9a98', marginBottom:24 }}>
                Emití tu primer CFE para empezar a gestionar facturación electrónica.
              </div>
              <button onClick={()=>setShowCFE(true)} style={{ background:G, color:'#fff',
                border:'none', borderRadius:10, padding:'12px 28px', fontFamily:F.sans,
                fontSize:14, fontWeight:600, cursor:'pointer' }}>+ Nuevo CFE</button>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de', overflow:'hidden' }}>
              <div style={{ display:'grid',
                gridTemplateColumns:'130px 110px 1fr 90px 120px 110px 100px',
                padding:'10px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                {['Número','Tipo','Cliente','Fecha','Venc.','Total','Estado'].map(h=>
                  <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                    letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
              </div>
              {cfesFiltrados.map((c,i)=>{
                const vencida = c.fechaVenc && daysUntil(c.fechaVenc)<0 &&
                  ['emitida','cobrado_parcial'].includes(c.status);
                return (
                  <div key={c.id} style={{
                    display:'grid',
                    gridTemplateColumns:'130px 110px 1fr 90px 120px 110px 100px',
                    padding:'13px 18px',
                    borderBottom:i<cfesFiltrados.length-1?'1px solid #f0f0ec':'none',
                    background: vencida?'#fef2f2' : i%2===0?'#fff':'#fafaf8',
                    transition:'background .1s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f7ec'}
                  onMouseLeave={e=>e.currentTarget.style.background=vencida?'#fef2f2':i%2===0?'#fff':'#fafaf8'}>
                    <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:600, color:'#1a1a18',
                      display:'flex', alignItems:'center' }}>{c.numero}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:F.sans, fontSize:12 }}>
                      {CFE_TIPOS[c.tipo]?.icon} {c.tipo}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans,
                      fontSize:13, fontWeight:500, color:'#1a1a18' }}>
                      <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                        style={{ background:'none', border:'none', cursor:'pointer',
                        fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0,
                        textDecoration:'underline', textDecorationColor:'#b8d9a8' }}>
                        {c.clienteNombre||'—'}
                      </button>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans,
                      fontSize:12, color:'#9a9a98' }}>{fmtDateShort(c.fecha)}</div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans, fontSize:12,
                      color: vencida?'#dc2626':'#9a9a98', fontWeight:vencida?700:400 }}>
                      {c.fechaVenc ? (vencida
                        ? `Vencida ${Math.abs(daysUntil(c.fechaVenc))}d`
                        : fmtDateShort(c.fechaVenc)) : '—'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.serif,
                      fontSize:16, color:G }}>{fmt.currency(c.total,c.moneda)}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Pill status={c.status} />
                      <button onClick={()=>setPdfCfe(c)} title="Ver PDF" style={{
                        background:'none', border:'none', cursor:'pointer',
                        color:'#059669', fontSize:13, padding:0, fontWeight:600 }}>🖨️</button>
                      {c.status!=='anulada'&&c.status!=='cobrada' && (
                        <button onClick={()=>anular(c.id)} title="Anular" style={{
                          background:'none', border:'none', cursor:'pointer',
                          color:'#9a9a98', fontSize:14, padding:0 }}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: CUENTA CORRIENTE
      ══════════════════════════════════════════════════════════════ */}
      {vista==='cuenta' && (
        <div>
          {/* Selector de cliente */}
          <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ flex:1, maxWidth:320 }}>
              <Lbl>Ver cuenta de</Lbl>
              <Sel value={detalleCli||''} onChange={e=>setDetalleCli(e.target.value||null)}>
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Sel>
            </div>
            {clienteDetalle && (
              <button onClick={()=>{setPrefill({clienteId:clienteDetalle.id,clienteNombre:clienteDetalle.nombre});setShowCFE(true);}}
                style={{ background:G, color:'#fff', border:'none', borderRadius:8,
                padding:'9px 18px', fontFamily:F.sans, fontSize:13, fontWeight:600,
                cursor:'pointer', marginTop:18 }}>+ Facturar</button>
            )}
          </div>

          {!clienteDetalle ? (
            <div style={{ textAlign:'center', padding:'48px', color:'#9a9a98',
              fontFamily:F.sans, fontSize:13, background:'#f9f9f7', borderRadius:12 }}>
              Seleccioná un cliente para ver su cuenta corriente
            </div>
          ) : (
            <div>
              {/* Header cliente */}
              <div style={{ background:'#fff', borderRadius:12, padding:'20px 24px',
                border:'1px solid #e2e2de', marginBottom:16,
                display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16 }}>
                {[
                  ['Cliente', clienteDetalle.nombre],
                  ['RUT', clienteDetalle.rut||'—'],
                  ['Cond. pago', COND_PAGO.find(c=>c.value===clienteDetalle.condPago)?.label||'—'],
                  ['Límite crédito', clienteDetalle.limiteCredito
                    ? fmt.currency(clienteDetalle.limiteCredito) : 'Sin límite'],
                ].map(([l,v])=>(
                  <div key={l}>
                    <Lbl>{l}</Lbl>
                    <div style={{ fontFamily:F.sans, fontSize:14, fontWeight:600, color:'#1a1a18' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* KPIs del cliente */}
              {(() => {
                const deudaCliente = cfesCliente
                  .filter(c=>['emitida','cobrado_parcial'].includes(c.status))
                  .reduce((s,c)=>s+(c.saldoPendiente||c.total||0),0);
                const vencidasCli = cfesCliente.filter(c=>
                  ['emitida','cobrado_parcial'].includes(c.status)&&
                  c.fechaVenc&&daysUntil(c.fechaVenc)<0);
                const cobradoCli  = cobrosCliente.reduce((s,c)=>s+c.monto,0);
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
                    background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                    <KpiCard label="Saldo deudor" value={deudaCliente>0?fmt.currency(deudaCliente):'—'}
                      accent={deudaCliente>0?'#dc2626':G} danger={deudaCliente>0} />
                    <KpiCard label="Facturas vencidas" value={vencidasCli.length}
                      accent={vencidasCli.length>0?'#dc2626':'#e2e2de'} danger={vencidasCli.length>0} />
                    <KpiCard label="Total cobrado" value={cobradoCli>0?fmt.currency(cobradoCli):'—'}
                      sub={`${cobrosCliente.length} cobros registrados`} accent={G} />
                    <KpiCard label="CFEs totales" value={cfesCliente.length}
                      sub={`${cfesCliente.filter(c=>c.status==='cobrada').length} cobradas`} />
                  </div>
                );
              })()}

              {/* Botón estado de cuenta */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button onClick={()=>setShowEstadoCuenta(true)}
                  style={{ padding:'8px 16px', background:'#fff', border:'1px solid #e2e2de',
                    borderRadius:8, fontFamily:F.sans, fontSize:12, fontWeight:600,
                    color:'#1a1a18', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                  Descargar estado de cuenta
                </button>
              </div>

              
              {/* Modal estado de cuenta */}
              {showEstadoCuenta && (
                <EstadoCuentaPDF
                  cliente={clienteDetalle}
                  cfes={cfesCliente}
                  cobros={cobrosCliente}
                  brandCfg={brandCfg}
                  onClose={() => setShowEstadoCuenta(false)}
                />
              )}

{/* Movimientos */}
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
                overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f0f0ec',
                  fontFamily:F.sans, fontSize:11, fontWeight:700, letterSpacing:'0.1em',
                  textTransform:'uppercase', color:'#9a9a98',
                  display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px 110px' }}>
                  {['Fecha','Comprobante/Cobro','Débito','Crédito','Saldo','Estado'].map(h=>
                    <div key={h}>{h}</div>)}
                </div>
                {/* Combinar CFEs + cobros del cliente ordenados por fecha */}
                {(() => {
                  const movs = [
                    ...cfesCliente.map(c=>({...c, _tipo:'cfe', _fecha:c.fecha})),
                    ...cobrosCliente.map(c=>({...c, _tipo:'cobro', _fecha:c.fecha})),
                  ].sort((a,b)=>new Date(b._fecha)-new Date(a._fecha));

                  let saldo = 0;
                  // calc saldo running (reverse)
                  const withSaldo = [...movs].reverse().map(m=>{
                    if (m._tipo==='cfe') saldo += m.total||0;
                    else saldo -= m.monto||0;
                    return {...m, _saldoAcum:saldo};
                  }).reverse();

                  if (withSaldo.length===0) return (
                    <div style={{ padding:'32px', textAlign:'center', color:'#9a9a98',
                      fontFamily:F.sans, fontSize:13 }}>
                      Sin movimientos para este cliente
                    </div>
                  );

                  return withSaldo.map((m,i)=>(
                    <div key={m.id} style={{
                      display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px 110px',
                      padding:'12px 18px', fontFamily:F.sans, fontSize:13,
                      borderBottom:i<withSaldo.length-1?'1px solid #f0f0ec':'none',
                      background: m._tipo==='cfe'&&m.status==='anulada'?'#f9f9f7':
                        i%2===0?'#fff':'#fafaf8',
                    }}>
                      <div style={{ color:'#9a9a98', fontSize:12 }}>{fmtDateShort(m._fecha)}</div>
                      <div style={{ fontWeight:500 }}>
                        {m._tipo==='cfe'
                          ? <><span style={{ fontFamily:F.mono, fontSize:12 }}>{m.numero}</span>
                              <span style={{ color:'#9a9a98', marginLeft:8, fontSize:11 }}>{m.tipo}</span></>
                          : <><span style={{ color:G, fontWeight:700 }}>💰 Cobro</span>
                              <span style={{ color:'#9a9a98', marginLeft:8, fontSize:11 }}>{m.metodo}</span></>
                        }
                      </div>
                      <div style={{ fontFamily:F.mono, color:'#dc2626', fontWeight:m._tipo==='cfe'?700:400 }}>
                        {m._tipo==='cfe' ? fmt.currency(m.total,m.moneda) : ''}
                      </div>
                      <div style={{ fontFamily:F.mono, color:G, fontWeight:m._tipo==='cobro'?700:400 }}>
                        {m._tipo==='cobro' ? fmt.currency(m.monto) : ''}
                      </div>
                      <div style={{ fontFamily:F.mono, fontSize:12, color:m._saldoAcum>0?'#dc2626':G, fontWeight:700 }}>
                        {fmt.currency(Math.abs(m._saldoAcum))}
                      </div>
                      <div>{m._tipo==='cfe'&&<Pill status={m.status}/>}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: COBROS
      ══════════════════════════════════════════════════════════════ */}
      {vista==='cobros' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:16 }}>
            <div style={{ fontFamily:F.sans, fontSize:13, color:'#6a6a68' }}>
              {cobros.length} cobros registrados
            </div>
            <button onClick={()=>setShowCob(true)} style={{ background:G, color:'#fff',
              border:'none', borderRadius:8, padding:'9px 18px', fontFamily:F.sans,
              fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Registrar cobro</button>
          </div>

          {cobros.length===0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:'#f9f9f7',
              borderRadius:12, color:'#9a9a98', fontFamily:F.sans, fontSize:13 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>💰</div>
              Sin cobros registrados aún
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
              overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 140px 120px 80px',
                padding:'10px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                {['Fecha','Cliente','Método','Monto','Facturas'].map(h=>
                  <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                    letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
              </div>
              {cobros.map((c,i)=>{
                const cli = clientes.find(x=>x.id===c.clienteId);
                return (
                  <div key={c.id} style={{
                    display:'grid', gridTemplateColumns:'100px 1fr 140px 120px 80px',
                    padding:'13px 18px', fontFamily:F.sans, fontSize:13,
                    borderBottom:i<cobros.length-1?'1px solid #f0f0ec':'none',
                    background:i%2===0?'#fff':'#fafaf8',
                  }}>
                    <div style={{ color:'#9a9a98', fontSize:12 }}>{fmtDateShort(c.fecha)}</div>
                    <div style={{ fontWeight:600 }}>
                      <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                        style={{ background:'none', border:'none', cursor:'pointer',
                        fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0 }}>
                        {cli?.nombre||c.clienteId||'—'}
                      </button>
                    </div>
                    <div style={{ color:'#6a6a68' }}>
                      <span style={{ background:'#f0f0ec', padding:'2px 8px', borderRadius:20,
                        fontSize:11, fontWeight:600 }}>{c.metodo}</span>
                      {c.fechaCheque && <span style={{ marginLeft:6, fontSize:11, color:'#9a9a98' }}>
                        dep. {fmtDateShort(c.fechaCheque)}</span>}
                    </div>
                    <div style={{ fontFamily:F.serif, fontSize:18, color:G, fontWeight:400 }}>
                      {fmt.currency(c.monto)}
                    </div>
                    <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98' }}>
                      {c.facturasAplicar?.length>0 ? `${c.facturasAplicar.length} fact.` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: INFORMES
      ══════════════════════════════════════════════════════════════ */}
      {vista==='informes' && (
        <div style={{ display:'grid', gap:24 }}>

          {/* Resumen aging */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
            padding:'20px 24px' }}>
            <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18', marginBottom:16 }}>
              Antigüedad de deuda (Aging)
            </div>
            {(() => {
              const buckets = { 'Al día':0, '1-30d':0, '31-60d':0, '61-90d':0, '+90d':0 };
              const colors  = { 'Al día':'#16a34a', '1-30d':'#d97706', '31-60d':'#ea580c', '61-90d':'#dc2626', '+90d':'#7f1d1d' };
              cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc)
                .forEach(c=>{
                  const d = -daysUntil(c.fechaVenc);
                  const b = agingBucket(d);
                  if (buckets[b.label]!==undefined) buckets[b.label]+=(c.saldoPendiente||c.total||0);
                });
              const total = Object.values(buckets).reduce((s,v)=>s+v,0)||1;
              return (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1,
                  background:'#e2e2de', borderRadius:10, overflow:'hidden' }}>
                  {Object.entries(buckets).map(([label,val])=>(
                    <div key={label} style={{ background:'#fff', padding:'16px 18px',
                      borderTop:`3px solid ${colors[label]}` }}>
                      <div style={{ fontFamily:F.sans, fontSize:11, fontWeight:700,
                        color:colors[label], marginBottom:6, textTransform:'uppercase',
                        letterSpacing:'0.08em' }}>{label}</div>
                      <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18' }}>
                        {val>0?fmt.currency(val):'—'}
                      </div>
                      <div style={{ height:4, background:'#f0f0ec', borderRadius:2, marginTop:8 }}>
                        <div style={{ height:'100%', background:colors[label], borderRadius:2,
                          width:`${(val/total)*100}%`, transition:'width .4s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Listado de deudores */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
            overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f0f0ec',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18' }}>Listado de deudores</div>
              <div style={{ fontFamily:F.sans, fontSize:13, color:'#9a9a98' }}>
                {deudores.length} clientes · {fmt.currency(totalDeuda)} total
              </div>
            </div>
            {deudores.length===0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#16a34a',
                fontFamily:F.sans, fontSize:14, fontWeight:600 }}>
                ✓ Sin deudores — todas las cuentas al día
              </div>
            ) : (
              <>
                <div style={{ display:'grid',
                  gridTemplateColumns:'1fr 80px 120px 110px 80px 100px',
                  padding:'9px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                  {['Cliente','Facturas','Total deuda','Venc. máx.','Aging',''].map(h=>
                    <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
                </div>
                {deudores.map((d,i)=>{
                  const bkt = agingBucket(d.diasMaxVenc);
                  return (
                    <div key={d.clienteId} style={{
                      display:'grid', gridTemplateColumns:'1fr 80px 120px 110px 80px 100px',
                      padding:'13px 18px', fontFamily:F.sans, fontSize:13,
                      borderBottom:i<deudores.length-1?'1px solid #f0f0ec':'none',
                      background:i%2===0?'#fff':'#fafaf8',
                    }}>
                      <div style={{ fontWeight:600 }}>
                        <button onClick={()=>{setDetalleCli(d.clienteId);setVista('cuenta');}}
                          style={{ background:'none', border:'none', cursor:'pointer',
                          fontFamily:F.sans, fontSize:13, fontWeight:700, color:G, padding:0,
                          textDecoration:'underline', textDecorationColor:'#b8d9a8' }}>
                          {d.nombre||'—'}
                        </button>
                      </div>
                      <div style={{ color:'#6a6a68' }}>{d.facturas.length}</div>
                      <div style={{ fontFamily:F.serif, fontSize:17, color:'#dc2626', fontWeight:400 }}>
                        {fmt.currency(d.totalDeuda)}
                      </div>
                      <div style={{ fontFamily:F.sans, fontSize:12,
                        color:d.diasMaxVenc>0?'#dc2626':'#16a34a', fontWeight:d.diasMaxVenc>0?700:400 }}>
                        {d.diasMaxVenc>0?`${d.diasMaxVenc}d vencida`:'Al día'}
                      </div>
                      <div>
                        <span style={{ background:bkt.bg, color:bkt.color,
                          fontFamily:F.sans, fontSize:10, fontWeight:700,
                          padding:'3px 9px', borderRadius:20, textTransform:'uppercase',
                          letterSpacing:'0.07em' }}>{bkt.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>{setDetalleCli(d.clienteId);setVista('cuenta');}}
                          style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:'#2563eb',
                          background:'#eff6ff', border:'none', borderRadius:6, padding:'4px 10px',
                          cursor:'pointer' }}>Ver</button>
                        <button onClick={()=>setShowCob(true)}
                          style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:G,
                          background:'#f0f7ec', border:'none', borderRadius:6, padding:'4px 10px',
                          cursor:'pointer' }}>Cobrar</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Facturas vencidas detalle */}
          {vencidasHoy.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #fecaca',
              overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #fecaca',
                background:'#fef2f2', display:'flex', justifyContent:'space-between' }}>
                <div style={{ fontFamily:F.serif, fontSize:22, color:'#dc2626' }}>
                  ⚠ Facturas vencidas ({vencidasHoy.length})
                </div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:'#dc2626', fontWeight:600 }}>
                  {fmt.currency(vencidasHoy.reduce((s,c)=>s+(c.saldoPendiente||c.total||0),0))} pendiente
                </div>
              </div>
              {vencidasHoy.map((c,i)=>(
                <div key={c.id} style={{
                  display:'grid', gridTemplateColumns:'120px 1fr 100px 110px 80px 90px',
                  padding:'12px 20px', fontFamily:F.sans, fontSize:13,
                  borderBottom:i<vencidasHoy.length-1?'1px solid #fef2f2':'none',
                  background:i%2===0?'#fff':'#fafaf8',
                }}>
                  <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:600 }}>{c.numero}</div>
                  <div style={{ fontWeight:600 }}>
                    <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                      style={{ background:'none', border:'none', cursor:'pointer',
                      fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0 }}>
                      {c.clienteNombre}
                    </button>
                  </div>
                  <div style={{ fontFamily:F.mono, color:G }}>{fmt.currency(c.saldoPendiente||c.total,c.moneda)}</div>
                  <div style={{ color:'#dc2626', fontWeight:700, fontSize:12 }}>
                    Vencida hace {Math.abs(daysUntil(c.fechaVenc))} días
                  </div>
                  <div><Pill status={c.status}/></div>
                  <div>
                    <button onClick={()=>setShowCob(true)}
                      style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:G,
                      background:'#f0f7ec', border:'none', borderRadius:6, padding:'4px 10px',
                      cursor:'pointer' }}>Cobrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────────────── */}
      {showCFE && (
        <ModalFactura
          clientes={clientes} productos={products}
          prefill={prefill}
          onSave={handleSaveCFE}
          onClose={()=>{setShowCFE(false);setPrefill(null);}}
        />
      )}
      {showCob && (
        <ModalCobro
          clientes={clientes} cfes={cfes}
          onSave={(cobro) => { handleSaveCobro(cobro); setShowCob(false); }}
          onClose={()=>setShowCob(false)}
        />
      )}
    {pdfCfe&&<FacturaPDF cfe={pdfCfe} brandCfg={brandCfg} onClose={()=>setPdfCfe(null)}/>}
    </div>
  );
}

export default FacturacionTab;


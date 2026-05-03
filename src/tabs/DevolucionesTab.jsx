import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db, SB_URL, getAuthHeaders , getSession, getOrgId} from '../lib/constants.js';


async function callRpc(fnName, params = {}) {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (r.ok) return { data: await r.json() };
  const err = await r.json().catch(() => ({}));
  throw new Error(err?.message || err?.hint || `RPC ${fnName} failed (${r.status})`);
}

async function fetchNextNroDevolucion(devolucionesLocal) {
  try {
    const { data } = await callRpc('next_nro_devolucion', {});
    if (typeof data === 'string' && data.startsWith('DEV-')) return data;
  } catch { /* fallback below */ }
  const nums = (devolucionesLocal || []).map(d => parseInt((d.nroDevolucion || 'DEV-0000').replace('DEV-', '')) || 0);
  return 'DEV-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

function DevolucionesTab(){
  const { products: prods, setProducts: setProds,
          devoluciones, setDevoluciones, ventas, setVentas, lotes, setLotes,
          setCfes, clientes,
          setHasPendingSync, addMov } = useApp();
  const G="#059669";
  const [vista,setVista]=useState("lista");
  const [form,setForm]=useState({ventaId:"",clienteNombre:"",motivo:"",items:[],notas:""});
  const [msg,setMsg]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const _ventaSeleccionada=ventas.find(v=>v.id===form.ventaId)||null;
  const iniciarDevolucion=(venta)=>{
    setForm({ventaId:venta.id,clienteNombre:venta.clienteNombre,motivo:"",notas:"",
      items:(venta.items||[]).map(it=>({...it,cantDevolver:0,estado:"pendiente",inspeccion:""}))});
    setVista("nueva");
  };
  const confirmarDevolucion=async ()=>{
    const itemsDevueltos=form.items.filter(it=>Number(it.cantDevolver)>0);
    if(itemsDevueltos.length===0){setMsg("Ingresa al menos un item a devolver");return;}
    if(!form.motivo){setMsg("Ingresa el motivo de la devolucion");return;}
    // ── Optimistic UI ────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const updProds = [...prods];
    const updLotes = [...lotes];

    itemsDevueltos.forEach(it => {
      if (it.inspeccion !== 'aprobado') return;
      const idx = updProds.findIndex(p => p.id === it.productoId);
      if (idx > -1) {
        updProds[idx] = { ...updProds[idx], stock: Number(updProds[idx].stock || 0) + Number(it.cantDevolver) };
      }
      if (it.loteId) {
        const li = updLotes.findIndex(l => l.id === it.loteId);
        if (li > -1) updLotes[li] = { ...updLotes[li], cantidad: Number(updLotes[li].cantidad || 0) + Number(it.cantDevolver) };
      }
    });
    setProds(updProds);
    setLotes(updLotes);

    // Ledger inmutable — llamar RPC por cada ítem aprobado
    const SB=import.meta.env.VITE_SUPABASE_URL;
    const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
    itemsDevueltos.filter(it=>it.inspeccion==='aprobado').forEach(it=>{
      const prod=prods.find(p=>p.id===it.productoId);
      if(prod?.uuid){
        fetch(`${SB}/rest/v1/rpc/stock_devolucion`,{
          method:'POST',
          headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({p_product_uuid:prod.uuid,p_qty:Number(it.cantDevolver),p_org_id:getOrgId(),p_ref:`devolucion-${form.ventaId||'manual'}`})
        }).catch(e=>console.warn('[DevolucionesTab] stock_devolucion RPC:',e));
      }
    });

    if (form.ventaId) {
      setVentas(ventas.map(v => v.id === form.ventaId ? { ...v, tieneDevolucion: true } : v));
    }

    // Generate nroDevolucion atomically via DB sequence
    const nroDevolucion = await fetchNextNroDevolucion(devoluciones);
    const dev = {
      id: crypto.randomUUID(), nroDevolucion,
      ventaId: form.ventaId, clienteNombre: form.clienteNombre,
      motivo: form.motivo, notas: form.notas,
      items: itemsDevueltos, estado: 'procesada',
      fecha: new Date().toLocaleDateString('es'),
      creadoEn: now,
    };
    setDevoluciones([dev, ...devoluciones]);
    // ── Generar nota de crédito automática ─────────────────────────
    const totalCredito = itemsDevueltos.reduce((s, it) => s + (Number(it.precio || 0) * Number(it.cantDevolver || 0)), 0);
    if (totalCredito > 0) {
      const notaCredito = {
        id: crypto.randomUUID(),
        tipo: 'nota_credito',
        nroDevolucion: dev.nroDevolucion,
        clienteId: form.clienteId || dev.clienteId,
        clienteNombre: form.clienteNombre || dev.clienteNombre,
        monto: totalCredito,
        motivo: form.motivo,
        fecha: new Date().toISOString().split('T')[0],
        items: itemsDevueltos.map(it => ({ nombre: it.nombre, qty: it.cantDevolver, precio: it.precio })),
        estado: 'emitida',
        createdAt: new Date().toISOString(),
      };
      // Save to cfes (facturas) as negative/credit
      if (typeof setCfes === 'function') {
        setCfes(prev => [{ ...notaCredito, saldoPendiente: -totalCredito, numero: 'NC-' + dev.nroDevolucion }, ...prev]);
      }
      // Persist to Supabase
      try {
        await callRpc('create_nota_credito', { p_data: JSON.stringify(notaCredito) });
      } catch (ncErr) {
        console.warn('[DevolucionesTab] nota_credito RPC:', ncErr?.message);
        // Non-blocking — the local state is already updated
      }
      console.debug('[DevolucionesTab] Nota de crédito generada:', notaCredito.id, totalCredito);
    }
    

    // ── Atomic DB write via create_devolucion RPC ────────────────────────
    const userEmail = (getSession()?.email || 'sistema');
    try {
      await callRpc('create_devolucion', {
        p_id:             dev.id,
        p_nro_devolucion: dev.nroDevolucion,
        p_venta_id:       form.ventaId || '',
        p_cliente_nombre: form.clienteNombre || '',
        p_motivo:         form.motivo || '',
        p_notas:          form.notas || '',
        p_items:          itemsDevueltos,
        p_user_email:     userEmail,
      });
    } catch (rpcErr) {
      // Revert all optimistic state
      setProds(prods);
      setLotes(lotes);
      setVentas(ventas);
      setDevoluciones(devoluciones);
      const errMsg = rpcErr?.message || '';
      if (errMsg.includes('authentication_required')) {
        setMsg('Sesión expirada. Recargá la página.');
      } else {
        setMsg('Error al procesar la devolución. Verificá tu conexión e intentá de nuevo.');
        console.error('[DevolucionesTab] create_devolucion RPC failed:', errMsg);
      }
      return;
    }

    setVista('lista');
    setMsg('Devolución ' + dev.nroDevolucion + ' procesada. Stock actualizado para items aprobados.');

    // M-1 bonus: auto-generate nota de crédito si hay items aprobados y existe venta
    const montoDev = itemsDevueltos
      .filter(it => it.inspeccion === 'aprobado')
      .reduce((s, it) => s + (Number(it.cantDevolver) * (Number(it.precioUnit || it.precio || 0))), 0);

    if (montoDev > 0 && form.ventaId && setCfes) {
      const ventaOrig = ventas.find(v => v.id === form.ventaId);
      const cliObj    = clientes?.find(c => c.id === ventaOrig?.clienteId);
      const nroCred   = 'NC-' + dev.nroDevolucion.replace('DEV-', '');
      const nc = {
        id:             crypto.randomUUID(),
        numero:         nroCred,
        tipo:           'e-N.Créd.',
        moneda:         brandCfg?.currency||'UYU',
        fecha:          new Date().toISOString().slice(0, 10),
        fechaVenc:      null,
        clienteId:      ventaOrig?.clienteId || null,
        clienteNombre:  dev.clienteNombre,
        clienteRut:     cliObj?.rut || '',
        subtotal:       montoDev,
        ivaTotal:       0,
        descuento:      0,
        total:          montoDev,
        saldoPendiente: montoDev,
        status:         'emitida',
        items:          [],
        notas:          `Nota de crédito automática por ${dev.nroDevolucion} — ${form.motivo}`,
        createdAt:      new Date().toISOString(),
      };
      setCfes(prev => [nc, ...prev]);
      db.upsert('invoices', {
        id:              nc.id,
        numero:          nc.numero,
        tipo:            nc.tipo,
        moneda:          nc.moneda,
        fecha:           nc.fecha,
        fecha_venc:      null,
        cliente_id:      nc.clienteId,
        cliente_nombre:  nc.clienteNombre,
        cliente_rut:     nc.clienteRut,
        subtotal:        nc.subtotal,
        iva_total:       0,
        descuento:       0,
        total:           nc.total,
        saldo_pendiente: nc.saldoPendiente,
        status:          nc.status,
        items:           nc.items,
        notas:           nc.notas,
        created_at:      nc.createdAt,
      }, 'id').catch(e => {
        console.warn('[DevolucionesTab] nota crédito upsert failed:', e?.message||e);
        setHasPendingSync(true);
      });
    }

    setTimeout(()=>setMsg(""),5000);
  };
  const MOTIVOS=["Producto danado","Error en pedido","Producto vencido","Exceso de stock","Otro"];
  if(vista==="nueva")return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setVista("lista")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Nueva devolucion — {form.clienteNombre}</h2>
      </div>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Motivo</label>
          <select value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} style={inp}>
            <option value="">- Seleccionar motivo -</option>
            {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
          </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Notas adicionales</label>
          <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Descripcion del estado..." style={inp} /></div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>Items a devolver:</div>
        {form.items.map((it,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{it.nombre}</div><div style={{fontSize:11,color:"#888"}}>Pedido: {it.cantidad} {it.unidad}</div></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Cant. a devolver</label>
            <input type="number" min="0" max={it.cantidad} value={it.cantDevolver} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],cantDevolver:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,width:70}} /></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Inspeccion</label>
            <select value={it.inspeccion} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],inspeccion:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,fontSize:12,color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#374151"}}>
              <option value="">- Estado -</option>
              <option value="aprobado">Aprobado (vuelve al stock)</option>
              <option value="rechazado">Rechazado (baja por calidad)</option>
              <option value="pendiente">Pendiente revision</option>
            </select></div>
            <div style={{fontSize:11,padding:"4px 8px",borderRadius:6,background:it.inspeccion==="aprobado"?"#f0fdf4":it.inspeccion==="rechazado"?"#fef2f2":"#f9fafb",color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#888",textAlign:"center",marginTop:16}}>
              {it.inspeccion==="aprobado"?"Reingresa stock":it.inspeccion==="rechazado"?"Se da de baja":"Sin accion"}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setVista("lista")} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarDevolucion} style={{padding:"10px 28px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Procesar devolucion</button>
      </div>
    </section>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Devoluciones</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Gestiona devoluciones de clientes con inspeccion y reingreso al stock</p>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {/* Solicitudes del portal B2B — pendientes de aprobacion */}
      {devoluciones.filter(d=>d.estado==='solicitada'||d.origen==='portal').length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <h3 style={{fontSize:15,fontWeight:700,color:'#dc2626',margin:0}}>
              Solicitudes del portal
            </h3>
            <span style={{background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:800,
              padding:'2px 8px',borderRadius:20,animation:'pulseDot 1.8s ease infinite'}}>
              {devoluciones.filter(d=>d.estado==='solicitada'||d.origen==='portal').length} pendiente{devoluciones.filter(d=>d.estado==='solicitada'||d.origen==='portal').length!==1?'s':''}
            </span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {devoluciones.filter(d=>d.estado==='solicitada'||d.origen==='portal').map((d,i)=>(
              <div key={d.id} style={{background:'#fff',borderRadius:12,padding:'14px 18px',
                border:'1px solid #fecaca',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{d.clienteNombre}</span>
                      <span style={{background:'#fff3cd',color:'#856404',fontSize:11,fontWeight:700,
                        padding:'2px 8px',borderRadius:20}}>Pendiente revision</span>
                    </div>
                    <div style={{fontSize:12,color:'#6a6a68'}}>
                      {d.motivo} · {(d.items||[]).length} producto{(d.items||[]).length!==1?'s':''}
                      {d.notas&&<span style={{marginLeft:6,color:'#d97706'}}>· {d.notas.slice(0,40)}</span>}
                    </div>
                    <div style={{fontSize:11,color:'#9a9a98',marginTop:2}}>{d.fecha||d.creadoEn?.slice(0,10)}</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>iniciarDevolucion(
                      ventas.find(v=>v.id===d.ventaId)||{id:d.ventaId,clienteNombre:d.clienteNombre,items:d.items||[]}
                    )} style={{padding:'7px 14px',background:G,color:'#fff',border:'none',
                      borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                      Procesar
                    </button>
                  </div>
                </div>
                {/* Items solicitados */}
                {(d.items||[]).filter(it=>Number(it.cantDevolver)>0).length>0&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f3f4f6'}}>
                    {(d.items||[]).filter(it=>Number(it.cantDevolver)>0).map((it,j)=>(
                      <div key={j} style={{fontSize:12,color:'#6a6a68',display:'flex',justifyContent:'space-between'}}>
                        <span>{it.nombre||it.name}</span>
                        <span style={{fontWeight:600}}>× {it.cantDevolver}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Iniciar devolucion desde venta</h3>
          {ventas.filter(v=>v.estado==="entregada").length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>No hay ventas entregadas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {ventas.filter(v=>v.estado==="entregada").slice(0,8).map((v,i)=>(
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:G}}>{v.nroVenta}</div>
                    <div style={{fontSize:11,color:"#666"}}>{v.clienteNombre} · {v.fecha}</div>
                  </div>
                  <button onClick={()=>iniciarDevolucion(v)} style={{padding:"5px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:12,color:"#374151"}}>Devolver</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Historial ({devoluciones.length})</h3>
          {devoluciones.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>Sin devoluciones registradas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {devoluciones.slice(0,8).map((d,i)=>(
                <div key={d.id} style={{padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>{d.nroDevolucion}</div>
                      <div style={{fontSize:11,color:"#666"}}>{d.clienteNombre} · {d.fecha}</div>
                    </div>
                    <span style={{background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{d.motivo}</span>
                  </div>
                  <div style={{fontSize:11,color:"#888",marginTop:4}}>{d.items.length} item(s) · {d.items.filter(it=>it.inspeccion==="aprobado").length} aprobados / {d.items.filter(it=>it.inspeccion==="rechazado").length} rechazados</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default DevolucionesTab;

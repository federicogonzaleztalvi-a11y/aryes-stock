import { useState, useMemo } from 'react';
import { useRole } from '../hooks/useRole.ts';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useNavigate } from 'react-router-dom';

function ClientesTab(){
  const { clientes: items, setClientes: setItems, ventas, cfes, priceListas } = useApp();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const G="#3a7d1e";
  const [agingOpen, setAgingOpen] = useState(false);
  // selId MUST be declared before crmMetrics useMemo (which references it)
  const [selId,setSelId]=useState(null);

  // Aging report — deuda por antigüedad desde CFEs con saldo pendiente
  const agingData = useMemo(() => {
    const now = new Date();
    const buckets = { c0_30: [], c31_60: [], c61_90: [], c91plus: [] };
    const byCli = {};
    cfes
      .filter(cfe => cfe.saldoPendiente > 0 && cfe.clienteId)
      .forEach(cfe => {
        const daysRef = cfe.fechaVenc ? cfe.fechaVenc : cfe.fecha;
        const dias = Math.floor((now - new Date(daysRef)) / 86400000);
        const cli = cfe.clienteId;
        if (!byCli[cli]) byCli[cli] = { nombre: cfe.clienteNombre, total: 0 };
        byCli[cli].total += cfe.saldoPendiente;
        const bucket = dias <= 30 ? 'c0_30' : dias <= 60 ? 'c31_60' : dias <= 90 ? 'c61_90' : 'c91plus';
        if (!buckets[bucket].find(x => x.id === cli))
          buckets[bucket].push({ id: cli, nombre: cfe.clienteNombre, monto: 0 });
        buckets[bucket].find(x => x.id === cli).monto += cfe.saldoPendiente;
      });
    return {
      buckets,
      totalDeuda: Object.values(byCli).reduce((a, v) => a + v.total, 0),
      clientesConDeuda: Object.keys(byCli).length,
    };
  }, [cfes]);

  // ── CRM metrics for the selected client ──────────────────────────────────
  const crmMetrics = useMemo(() => {
    if (!selId) return null;
    const clienteVentas = ventas
      .filter(v => v.clienteId === selId && v.estado !== 'cancelada')
      .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
    if (clienteVentas.length === 0) return { ventasCount: 0, totalComprado: 0, ticketPromedio: 0, diasDesdeUltima: null, topProductos: [], ultimasVentas: [] };
    const totalComprado   = clienteVentas.reduce((s, v) => s + Number(v.total || 0), 0);
    const ticketPromedio  = totalComprado / clienteVentas.length;
    const ultimaFecha     = new Date(clienteVentas[0].creadoEn);
    const diasDesdeUltima = Math.floor((Date.now() - ultimaFecha) / 86400000);
    // Top products by total quantity across all sales
    const prodMap = {};
    clienteVentas.forEach(v => (v.items || []).forEach(it => {
      const k = it.nombre || it.productoId;
      prodMap[k] = (prodMap[k] || 0) + Number(it.cantidad || 0);
    }));
    const topProductos = Object.entries(prodMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));
    // Saldo pendiente de CFEs abiertos para este cliente
    const saldoPendiente = cfes
      .filter(c => c.clienteId === selId && ['emitida','cobrado_parcial'].includes(c.status))
      .reduce((s, c) => s + (c.saldoPendiente || c.total || 0), 0);
    return { ventasCount: clienteVentas.length, totalComprado, ticketPromedio, diasDesdeUltima, topProductos, ultimasVentas: clienteVentas.slice(0, 5), allVentas: clienteVentas, saldoPendiente };
  }, [selId, ventas, cfes]);
  const { confirm, ConfirmDialog } = useConfirm();
  const TIPOS=["Panadería","Heladería","Pastelería","HORECA","Catering","Supermercado","Otro"];
  const TCOLOR={"Panadería":"#f59e0b","Heladería":"#3b82f6","Pastelería":"#ec4899","HORECA":"#8b5cf6","Catering":"#06b6d4","Supermercado":"#10b981","Otro":"#6b7280"};
  const emptyForm={nombre:'',tipo:'Panadería',condPago:'credito_30',limiteCredito:'',emailFacturacion:'',rut:'',telefono:'',email:'',direccion:'',ciudad:'',contacto:'',notas:'',listaId:'',horarioDesde:'',horarioHasta:''};
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  
  
  const [q,setQ]=useState('');
  const [filtro,setFiltro]=useState('Todos');
  const [vista,setVista]=useState('lista');
  const [msg,setMsg]=useState('');
  const [verTodasVentas, setVerTodasVentas]=useState(false);
  const sel=items.find(x=>x.id===selId);

  // ── persist to Supabase clients table (non-blocking) ────────
  const syncClient = (client) => {
    db.upsert('clients', {
      id:                client.id,
      nombre:            client.nombre,
      tipo:              client.tipo              || 'Otro',
      rut:               client.rut              || '',
      telefono:          client.telefono          || '',
      email:             client.email             || '',
      email_facturacion: client.emailFacturacion  || '',
      contacto:          client.contacto          || '',
      direccion:         client.direccion         || '',
      ciudad:            client.ciudad            || '',
      cond_pago:         client.condPago          || 'credito_30',
      limite_credito:    client.limiteCredito ? Number(client.limiteCredito) : null,
      lista_id:         client.listaId || null,
      horario_desde:    client.horarioDesde || null,
      horario_hasta:    client.horarioHasta  || null,
      lat:              client.lat ?? null,
      lng:              client.lng ?? null,
      geocoded_at:      client.geocodedAt || null,
      notas:             client.notas             || '',
      created_at:        client.creado            || new Date().toISOString(),
    }, 'id').catch(e=>{
      console.warn('[ClientesTab] syncClient failed:', e?.message||e);
      setMsg('⚠ Cliente guardado localmente — no se pudo sincronizar con el servidor');
      setTimeout(()=>setMsg(''),5000);
    });
  };

  const save=()=>{
    if(!form.nombre.trim()){setMsg('Nombre obligatorio');return;}
    const isNew = !editId;
    const newId = isNew ? crypto.randomUUID() : editId;
    const record = isNew
      ? {...form, id: newId, creado: new Date().toISOString(), lat: null, lng: null, geocodedAt: null, horarioDesde: null, horarioHasta: null}
      : {...items.find(x=>x.id===editId), ...form};
    const upd = isNew
      ? [...items, record]
      : items.map(x=>x.id===editId ? record : x);
    setItems(upd);
    syncClient(record);                          // → Supabase clients table
    setMsg(editId?'Cliente actualizado':'Cliente agregado');
    setForm(emptyForm);setEditId(null);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };

  const del=async(id)=>{
    const ok = await confirm({ title:'¿Eliminar cliente?', description:'Esta acción no se puede deshacer.', variant:'danger' });
    if(!ok) return;
    const upd=items.filter(x=>x.id!==id);
    setItems(upd);
    db.del('clients',{id}).catch(e=>{
      console.warn('[ClientesTab] delete client failed:', e?.message||e);
      setMsg('⚠ Eliminado localmente — no se pudo sincronizar con el servidor');
      setTimeout(()=>setMsg(''),5000);
    });
    setVista('lista');
  };

  const edit=(x)=>{setForm({nombre:x.nombre,tipo:x.tipo,rut:x.rut||'',telefono:x.telefono||'',email:x.email||'',direccion:x.direccion||'',ciudad:x.ciudad||'',contacto:x.contacto||'',notas:x.notas||'',condPago:x.condPago||'credito_30',limiteCredito:x.limiteCredito||'',emailFacturacion:x.emailFacturacion||'',listaId:x.listaId||'',horarioDesde:x.horarioDesde||'',horarioHasta:x.horarioHasta||''});setEditId(x.id);setVista('form');};
  const filtered=items.filter(x=>(!q||x.nombre.toLowerCase().includes(q.toLowerCase())||(x.ciudad||'').toLowerCase().includes(q.toLowerCase()))&&(filtro==='Todos'||x.tipo===filtro));
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const backBtn=<button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>;
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>{backBtn}<h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar cliente':'Nuevo cliente'}</h2></div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'Nombre *',k:'nombre',full:true},{l:'Tipo',k:'tipo',sel:true},{l:'RUT',k:'rut'},{l:'Teléfono',k:'telefono'},{l:'Email',k:'email'},{l:'Contacto',k:'contacto'},{l:'Dirección',k:'direccion',full:true},{l:'Ciudad',k:'ciudad'},{l:'Notas',k:'notas',full:true,ta:true},{l:'Cond. pago',k:'condPago',sel2:true},{l:'Límite crédito (USD)',k:'limiteCredito'},{l:'Email facturación',k:'emailFacturacion',full:true},{l:'Lista de precios',k:'listaId',sel3:true},{l:'Horario recepción (desde)',k:'horarioDesde',type:'time'},{l:'Horario recepción (hasta)',k:'horarioHasta',type:'time'}].map(fld=>(
          <div key={fld.k} style={{gridColumn:fld.full?'1/-1':'auto'}}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{fld.l}</label>
            {fld.sel?<select value={form[fld.k]} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value}))} style={{...inp,background:'#fff'}}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select>
            :fld.sel2?<select value={form[fld.k]} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value}))} style={{...inp,background:'#fff'}}><option value='contado'>Contado</option><option value='credito_15'>Crédito 15 días</option><option value='credito_30'>Crédito 30 días</option><option value='credito_60'>Crédito 60 días</option><option value='credito_90'>Crédito 90 días</option></select>
            :fld.sel3?<select value={form[fld.k]||''} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value||null}))} style={{...inp,background:'#fff'}}><option value=''>Sin lista asignada</option>{priceListas.filter(l=>l.activa!==false).map(l=><option key={l.id} value={l.id}>{l.nombre} (−{l.descuento}%)</option>)}</select>
            :fld.type==='time'?<input type='time' value={form[fld.k]||''} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value||null}))} style={{...inp,width:'auto'}} />
            :fld.ta?<textarea value={form[fld.k]} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}} />
            :<input value={form[fld.k]} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value}))} style={inp} />}
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
          <button onClick={()=>{setVista('lista');setEditId(null);}} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={save} style={{padding:'9px 24px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>{editId?'Guardar':'Agregar cliente'}</button>
        </div>
      </div>
    </section>
  );
  if(vista==='detalle'&&sel)return(
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      {/* Header con acciones directas */}
      <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
        {backBtn}
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:'0',flex:1}}>{sel.nombre}</h2>
        <span style={{background:TCOLOR[sel.tipo]||'#6b7280',color:'#fff',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,marginRight:10}}>{sel.tipo}</span>
      </div>

      {/* Acciones directas */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {sel.telefono&&(
          <a href={`https://wa.me/${sel.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,color:G,fontSize:12,fontWeight:700,textDecoration:'none'}}>
            💬 WhatsApp
          </a>
        )}
        {sel.telefono&&(
          <a href={`tel:${sel.telefono}`}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,color:'#374151',fontSize:12,fontWeight:600,textDecoration:'none'}}>
            📞 Llamar
          </a>
        )}
        {sel.email&&(
          <a href={`mailto:${sel.email}`}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,color:'#374151',fontSize:12,fontWeight:600,textDecoration:'none'}}>
            ✉ Email
          </a>
        )}
        <button onClick={()=>navigate('/app/ventas')}
          style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:G,border:'none',borderRadius:8,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          + Nueva venta
        </button>
      </div>

      {/* Saldo pendiente — solo si tiene deuda */}
      {crmMetrics&&crmMetrics.saldoPendiente>0&&(
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>⚠ Saldo pendiente de cobro</span>
          <span style={{fontSize:18,fontWeight:800,color:'#dc2626'}}>
            ${Number(crmMetrics.saldoPendiente).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </span>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'RUT',v:sel.rut||'—'},{l:'Teléfono',v:sel.telefono||'—'},{l:'Email',v:sel.email||'—'},{l:'Contacto',v:sel.contacto||'—'},{l:'Dirección',v:sel.direccion||'—',full:true},{l:'Ciudad',v:sel.ciudad||'—'},{l:'Cond. pago',v:{contado:'Contado',credito_15:'Crédito 15d',credito_30:'Crédito 30d',credito_60:'Crédito 60d',credito_90:'Crédito 90d'}[sel.condPago]||'—'},{l:'Lista de precios',v:sel.listaId?((priceListas.find(l=>l.id===sel.listaId)?.nombre)||sel.listaId):'Sin lista'},{l:'Horario recepción',v:(sel.horarioDesde||sel.horarioHasta)?(sel.horarioDesde||'?')+' – '+(sel.horarioHasta||'?'):'Sin restricción'},{l:'Límite crédito',v:sel.limiteCredito?'USD '+sel.limiteCredito:'Sin límite'},{l:'Cliente desde',v:sel.creado?new Date(sel.creado).toLocaleDateString('es-UY'):'—'},{l:'Notas',v:sel.notas||'—',full:true}].map(row=>(
          <div key={row.l} style={{gridColumn:row.full?'1/-1':'auto'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{row.l}</div>
            <div style={{fontSize:14,color:'#1a1a1a'}}>{row.v}</div>
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8,borderTop:'1px solid #f3f4f6',paddingTop:16}}>
          {isAdmin&&<button onClick={()=>del(sel.id)} style={{padding:'8px 18px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',color:'#dc2626',cursor:'pointer',fontSize:13}}>Eliminar</button>}
          {isAdmin&&<button onClick={()=>edit(sel)} style={{padding:'8px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Editar</button>}
        </div>
      </div>

      {/* ── Actividad comercial ───────────────────────────────── */}
      {crmMetrics && (
        <div style={{marginTop:20,background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#1a1a1a',marginBottom:16}}>
            Actividad comercial
          </div>

          {crmMetrics.ventasCount === 0 ? (
            <div style={{textAlign:'center',padding:'24px 0',color:'#888',fontSize:13}}>
              Sin ventas registradas para este cliente
            </div>
          ) : (
            <>
              {/* KPI strip */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'#e2e2de',borderRadius:10,overflow:'hidden',marginBottom:20}}>
                {[
                  {l:'Compras totales', v: crmMetrics.ventasCount},
                  {l:'Total comprado',  v: '$'+Number(crmMetrics.totalComprado).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})},
                  {l:'Ticket promedio', v: '$'+Number(crmMetrics.ticketPromedio).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})},
                  {l:'Última compra',   v: crmMetrics.diasDesdeUltima === 0 ? 'Hoy' : crmMetrics.diasDesdeUltima === 1 ? 'Ayer' : `Hace ${crmMetrics.diasDesdeUltima}d`,
                   accent: crmMetrics.diasDesdeUltima > 30 ? '#dc2626' : crmMetrics.diasDesdeUltima > 14 ? '#d97706' : G},
                ].map(k => (
                  <div key={k.l} style={{background:'#fff',padding:'14px 16px'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:18,fontWeight:700,color:k.accent||'#1a1a1a'}}>{k.v}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                {/* Top productos */}
                {crmMetrics.topProductos.length > 0 && (
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Productos más comprados</div>
                    {crmMetrics.topProductos.map((p,i) => (
                      <div key={p.nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<crmMetrics.topProductos.length-1?'1px solid #f3f4f6':'none'}}>
                        <span style={{width:20,height:20,borderRadius:'50%',background:G+'22',color:G,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                        <span style={{flex:1,fontSize:13,color:'#1a1a1a'}}>{p.nombre}</span>
                        <span style={{fontSize:12,color:'#888'}}>{Number(p.cantidad).toLocaleString('es-UY')} u.</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Historial de ventas — expandible */}
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:.5}}>
                      Historial de compras ({crmMetrics.ventasCount})
                    </div>
                    {crmMetrics.allVentas.length > 5 && (
                      <button onClick={()=>setVerTodasVentas(v=>!v)}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:11,fontWeight:700,color:G,padding:0}}>
                        {verTodasVentas ? 'Ver menos ▲' : `Ver todas (${crmMetrics.allVentas.length}) ▼`}
                      </button>
                    )}
                  </div>
                  {(verTodasVentas ? crmMetrics.allVentas : crmMetrics.ultimasVentas).map((v,i) => {
                    const ECOL={pendiente:'#f59e0b',confirmada:'#3b82f6',preparada:'#8b5cf6',entregada:G,cancelada:'#9ca3af'};
                    const lista = verTodasVentas ? crmMetrics.allVentas : crmMetrics.ultimasVentas;
                    return(
                      <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<lista.length-1?'1px solid #f3f4f6':'none'}}>
                        <span style={{fontSize:12,color:'#888',minWidth:56}}>{v.creadoEn?new Date(v.creadoEn).toLocaleDateString('es-UY',{day:'2-digit',month:'short'}):'—'}</span>
                        <span style={{fontSize:11,fontWeight:700,color:'#888',minWidth:60}}>{v.nroVenta}</span>
                        <span style={{flex:1,fontSize:13,fontWeight:700,color:G}}>${Number(v.total||0).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                        <span style={{fontSize:10,fontWeight:700,color:ECOL[v.estado]||'#888',background:(ECOL[v.estado]||'#888')+'18',padding:'2px 8px',borderRadius:20}}>{v.estado}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
  return(
    <>{ConfirmDialog}<section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Clientes <span style={{fontSize:16,color:'#888',fontWeight:400}}>({filtered.length})</span></h2>
        {isAdmin&&<button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nuevo cliente</button>}
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <input placeholder="Buscar nombre o ciudad..." value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,minWidth:200,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>👥</div>
          <p style={{fontSize:15,marginBottom:4}}>{items.length===0?'Todavía no hay clientes cargados':'Sin resultados para esa búsqueda'}</p>
          {items.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Agregar primer cliente</button>}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {filtered.map(x=>(
            <div key={x.id} onClick={()=>{setSelId(x.id);setVista('detalle');}} style={{background:'#fff',borderRadius:10,padding:18,boxShadow:'0 1px 4px rgba(0,0,0,.06)',cursor:'pointer',border:'1px solid #f3f4f6'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontWeight:600,fontSize:15,color:'#1a1a1a',lineHeight:1.3}}>{x.nombre}</div>
                <span style={{background:TCOLOR[x.tipo]||'#6b7280',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,flexShrink:0,marginLeft:8}}>{x.tipo}</span>
              </div>
              {x.ciudad&&<div style={{fontSize:12,color:'#666',marginBottom:4}}>📍 {x.ciudad}</div>}
              {x.telefono&&<div style={{fontSize:12,color:'#666',marginBottom:4}}>📞 {x.telefono}</div>}
              {x.contacto&&<div style={{fontSize:12,color:'#666'}}>👤 {x.contacto}</div>}
            </div>
          ))}
        </div>
      )}
      {/* ── Aging report ──────────────────────────────────────────────────────── */}
      <div style={{marginTop:24,background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <button onClick={()=>setAgingOpen(o=>!o)}
          style={{width:'100%',display:'flex',alignItems:'center',gap:10,background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
          <span style={{fontSize:16}}>📊</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:500,color:'#1a1a1a',flex:1}}>
            Aging de deuda — {agingData.clientesConDeuda} clientes · US$ {agingData.totalDeuda.toFixed(2)}
          </span>
          <span style={{fontSize:11,color:'#9ca3af'}}>{agingOpen?'▲':'▼'}</span>
        </button>
        {agingOpen&&(
          <div style={{marginTop:16}}>
            {agingData.totalDeuda===0?(
              <div style={{textAlign:'center',padding:'20px',color:'#10b981',fontWeight:600,fontSize:13}}>
                ✓ Sin deuda pendiente
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                {[
                  {label:'0–30 días',key:'c0_30',color:'#10b981',bg:'#f0fdf4'},
                  {label:'31–60 días',key:'c31_60',color:'#f59e0b',bg:'#fffbeb'},
                  {label:'61–90 días',key:'c61_90',color:'#f97316',bg:'#fff7ed'},
                  {label:'+90 días',key:'c91plus',color:'#ef4444',bg:'#fef2f2'},
                ].map(({label,key,color,bg})=>{
                  const rows = agingData.buckets[key];
                  const total = rows.reduce((a,r)=>a+r.monto,0);
                  return(
                    <div key={key} style={{background:bg,borderRadius:10,padding:'14px 16px'}}>
                      <div style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{label}</div>
                      <div style={{fontSize:22,fontWeight:800,color}}>US$ {total.toFixed(0)}</div>
                      <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{rows.length} cliente{rows.length!==1?'s':''}</div>
                      {rows.length>0&&(
                        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3}}>
                          {rows.sort((a,b)=>b.monto-a.monto).map(r=>(
                            <div key={r.id} style={{fontSize:11,display:'flex',justifyContent:'space-between'}}>
                              <span style={{color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:90}}>{r.nombre}</span>
                              <span style={{color,fontWeight:700}}>US$ {r.monto.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{fontSize:11,color:'#9ca3af',fontStyle:'italic'}}>
              Basado en la fecha de vencimiento de CFEs con saldo pendiente.
            </div>
          </div>
        )}
      </div>

    </section></>
  );
}

export default ClientesTab;

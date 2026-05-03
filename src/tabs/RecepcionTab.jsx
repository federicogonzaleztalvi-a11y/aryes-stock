import { useState, useEffect } from 'react';
import EtiquetasPDF from '../components/EtiquetasPDF.jsx';
import { useApp } from '../context/AppContext.tsx';
import { LS, db, SB_URL, getAuthHeaders , getSession, getOrgId } from '../lib/constants.js';


// ── callRpc — invoca una función Postgres SECURITY DEFINER ───────────────────
async function callRpc(fnName, params = {}) {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (r.ok) return { data: await r.json() };
  const err = await r.json().catch(() => ({}));
  throw new Error(err?.message || err?.hint || `RPC ${fnName} failed (${r.status})`);
  return etiquetaPallet ? <EtiquetasPDF tipo="pallet" data={etiquetaPallet} brandCfg={window.__brandCfg||{}} onClose={()=>setEtiquetaPallet(null)}/> : null; // placeholder
}

function RecepcionTab(){
  const { products: prods, setProducts: setProds, orders: pedidos, addMov, lotes, setLotes } = useApp();
  const G="#059669";
  const KREC="aryes-recepciones";
  const [recepciones,setRecepciones]=useState([]);
  const [vista,setVista]=useState('lista');
  const [etiquetaPallet,setEtiquetaPallet]=useState(null);
  const [pedidoSel,setPedidoSel]=useState(null);
  const [items,setItems]=useState([]);
  const [proveedor,setProveedor]=useState('');
  const [nroRemito,setNroRemito]=useState('');
  const [fecha,setFecha]=useState(new Date().toISOString().split('T')[0]);
  const [notas,setNotas]=useState('');
  const [msg,setMsg]=useState('');
  const [saving,setSaving]=useState(false);

  const pendientes=pedidos.filter(p=>p.status==='pending'||p.status==='ordered'||!p.status);

  const iniciarRecepcion=(ped)=>{
    setPedidoSel(ped);
    setProveedor(ped.supplierName||'');
    // Build items from order
    const its=ped?[{
      productoId: ped.productId||ped.id,
      nombre: ped.productName||ped.nombre||'Producto',
      cantidadEsperada: Number(ped.qty||ped.cantidad||0),
      cantidadRecibida: Number(ped.qty||ped.cantidad||0),
      cantidadRechazada: 0,
      unidad: ped.unit||ped.unidad||'u',
      lote: '',
      vencimiento: '',
      calidad: 'ok',
      motivoRechazo: '',
      diferencia: 0,
    }]:[];
    setItems(its);
    setVista('recepcion');
  };

  const iniciarManual=()=>{
    setPedidoSel(null);
    setProveedor('');
    setItems([{
      productoId:'',nombre:'',
      cantidadEsperada:0,cantidadRecibida:0,cantidadRechazada:0,
      unidad:'u',lote:'',vencimiento:'',calidad:'ok',motivoRechazo:'',diferencia:0
    }]);
    setVista('recepcion');
  };

  // Bridge desde PedidosInline: lee pedido pre-cargado de sessionStorage al montar
  useEffect(() => {
    const raw = sessionStorage.getItem('aryes-recepcion-from-order');
    sessionStorage.removeItem('aryes-recepcion-from-order');
    try { iniciarRecepcion(JSON.parse(raw)); } catch {}
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const updateItem=(idx,field,val)=>{
    setItems(prev=>prev.map((it,i)=>{
      if(i!==idx)return it;
      const upd={...it,[field]:val};
      if(field==='cantidadRecibida'||field==='cantidadEsperada'){
        upd.diferencia=Number(upd.cantidadRecibida)-Number(upd.cantidadEsperada);
      }
      return upd;
    }));
  };

  const agregarItem=()=>setItems(prev=>[...prev,{
    productoId:'',nombre:'',
    cantidadEsperada:0,cantidadRecibida:0,cantidadRechazada:0,
    unidad:'u',lote:'',vencimiento:'',calidad:'ok',motivoRechazo:'',diferencia:0
  }]);

  const confirmarRecepcion=async ()=>{
    if(saving)return;
    setSaving(true);
    try{
    if(items.length===0){setMsg('No hay items');return;}
    const ahora=new Date().toISOString();

    // ── Optimistic UI: update stock locally for immediate feedback ─────────
    const updProds=[...prods];
    items.forEach(it=>{
      if(!it.nombre||Number(it.cantidadRecibida)===0)return;
      const idx=updProds.findIndex(p=>
        p.id===it.productoId||
        p.nombre?.toLowerCase()===it.nombre.toLowerCase()||
        p.name?.toLowerCase()===it.nombre.toLowerCase()
      );
      if(idx>-1){
        updProds[idx]={...updProds[idx],stock:(Number(updProds[idx].stock||0)+Number(it.cantidadRecibida))};
      }
    });
    setProds(updProds);

    // Ledger inmutable — RPC por cada ítem recibido
    const SB_R=import.meta.env.VITE_SUPABASE_URL;
    const KEY_R=import.meta.env.VITE_SUPABASE_ANON_KEY;
    items.forEach(it=>{
      const prod=prods.find(p=>p.id===it.productoId||p.nombre?.toLowerCase()===it.nombre?.toLowerCase()||p.name?.toLowerCase()===it.nombre?.toLowerCase());
      if(prod?.uuid&&Number(it.cantidadRecibida)>0){
        fetch(`${SB_R}/rest/v1/rpc/stock_recepcion`,{
          method:'POST',
          headers:{apikey:KEY_R,Authorization:`Bearer ${KEY_R}`,'Content-Type':'application/json'},
          body:JSON.stringify({p_product_uuid:prod.uuid,p_qty:Number(it.cantidadRecibida),p_org_id:getOrgId(),p_ref:`recepcion-${pedidoSel?.id||'manual'}`})
        }).catch(e=>console.warn('[RecepcionTab] stock_recepcion RPC:',e));
      }
    });

    // ── Optimistic UI: add lotes locally ────────────────────────────────────
    const updLotes=[...lotes];
    items.forEach(it=>{
      if(!it.vencimiento||Number(it.cantidadRecibida)===0)return;
      const prod=updProds.find(p=>p.id===it.productoId||p.nombre?.toLowerCase()===it.nombre.toLowerCase()||p.name?.toLowerCase()===it.nombre.toLowerCase());
      updLotes.push({
        id:crypto.randomUUID(),
        productoId:prod?.id||it.productoId,
        productoNombre:it.nombre,
        lote:it.lote||(`REC-${Date.now()}`),
        cantidad:Number(it.cantidadRecibida),
        fechaVenc:it.vencimiento,
        proveedor,
        notas:'Ingreso por recepcion',
        creadoEn:ahora,
      });
    });
    setLotes(updLotes);

    // ── Optimistic UI: add recepcion to local list ──────────────────────────
    const recId=crypto.randomUUID();
    const rec={
      id:recId, fecha, proveedor, nroRemito, notas,
      pedidoId:pedidoSel?.id||null, items,
      estado:'completada', creadoEn:ahora,
      diferencias:items.filter(it=>it.diferencia!==0).length,
    };
    const updRec=[rec,...recepciones];
    setRecepciones(updRec);
    // recepciones: Supabase is source of truth

    // ── Atomic DB write via create_recepcion RPC ─────────────────────────────
    // One Postgres transaction: stock increments + movements + lotes + recepcion + audit.
    // On error: revert all optimistic state updates.
    const userEmail=(getSession()?.email || 'sistema');
    try {
      await callRpc('create_recepcion', {
        p_id:         recId,
        p_fecha:      fecha || '',
        p_proveedor:  proveedor || '',
        p_nro_remito: nroRemito || '',
        p_notas:      notas || '',
        p_pedido_id:  pedidoSel?.id || '',
        p_items:      items,
        p_user_email: userEmail,
      });
    } catch (rpcErr) {
      // Revert all optimistic state
      setProds(prods);
      setLotes(lotes);
      setRecepciones(recepciones);
      // recepciones: Supabase is source of truth
      const errMsg = rpcErr?.message || '';
      if (errMsg.includes('authentication_required')) {
        setMsg('Sesión expirada. Recargá la página.');
      } else if (errMsg.includes('product_not_found')) {
        const parts = errMsg.split(':');
        setMsg(`Producto no encontrado: ${parts[1]||'desconocido'}. Verificá el catálogo.`);
      } else {
        setMsg('Error al confirmar la recepción. Verificá tu conexión e intentá de nuevo.');
        console.error('[RecepcionTab] create_recepcion RPC failed:', errMsg);
      }
      setSaving(false);
      return;
    }

    setMsg('Recepción confirmada. Stock actualizado.');
    setVista('lista');
    setTimeout(()=>setMsg(''),4000);
      }finally{setSaving(false);}
  };
  const inp={padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};

  // VISTA RECEPCION - formulario guiado
  if(vista==='recepcion')return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
        <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>←</button>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Recepcion de mercaderia</h2>
          <p style={{fontSize:12,color:'#888',margin:'2px 0 0'}}>{pedidoSel?'Basado en pedido a '+proveedor:'Recepcion manual'}</p>
        </div>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Header data */}
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Proveedor</label>
            <input style={inp} value={proveedor} onChange={e=>setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Nro. Remito</label>
            <input style={inp} value={nroRemito} onChange={e=>setNroRemito(e.target.value)} placeholder="Ej: 0001-000123" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type="date" style={inp} value={fecha} onChange={e=>setFecha(e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Notas</label>
            <input style={inp} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{padding:'12px 16px',background:'#f9fafb',borderBottom:'2px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,color:'#374151',fontSize:14}}>Detalle de mercaderia recibida</span>
          <button onClick={agregarItem} style={{padding:'5px 14px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>+ Agregar item</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                {['Producto','Esperado','Recibido','Rechazado','Unidad','Lote','Vencimiento','Calidad','Diferencia',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it,i)=>(
                <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:it.diferencia<0?'#fef2f2':it.diferencia>0?'#fffbeb':'#fff'}}>
                  <td style={{padding:'8px 10px',minWidth:180}}>
                    {pedidoSel?(
                      <span style={{fontWeight:600,color:'#1a1a1a'}}>{it.nombre}</span>
                    ):(
                      <input style={{...inp,minWidth:160}} value={it.nombre} onChange={e=>updateItem(i,'nombre',e.target.value)} placeholder="Nombre del producto" />
                    )}
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80}} value={it.cantidadEsperada} onChange={e=>updateItem(i,'cantidadEsperada',e.target.value)} min="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80,fontWeight:700,borderColor:it.diferencia!==0?'#f59e0b':'#e5e7eb'}} value={it.cantidadRecibida} onChange={e=>updateItem(i,'cantidadRecibida',e.target.value)} min="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80,fontWeight:700,borderColor:Number(it.cantidadRechazada||0)>0?'#ef4444':'#e5e7eb',color:Number(it.cantidadRechazada||0)>0?'#dc2626':'#1a1a1a'}} value={it.cantidadRechazada||0} onChange={e=>updateItem(i,'cantidadRechazada',e.target.value)} min="0" placeholder="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:80}}>
                    <input style={{...inp,width:70}} value={it.unidad} onChange={e=>updateItem(i,'unidad',e.target.value)} placeholder="u" />
                  </td>
                  <td style={{padding:'8px 10px',width:120}}>
                    <input style={{...inp,width:110,fontFamily:'monospace'}} value={it.lote} onChange={e=>updateItem(i,'lote',e.target.value)} placeholder="Nro. lote" />
                  </td>
                  <td style={{padding:'8px 10px',width:130}}>
                    <input type="date" style={{...inp,width:120}} value={it.vencimiento} onChange={e=>updateItem(i,'vencimiento',e.target.value)} />
                  </td>
                  <td style={{padding:'8px 10px',width:100}}>
                    <select value={it.calidad||'ok'} onChange={e=>updateItem(i,'calidad',e.target.value)} style={{padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,fontWeight:700,fontFamily:'inherit',color:it.calidad==='rechazado'?'#dc2626':it.calidad==='observado'?'#f59e0b':'#059669',background:it.calidad==='rechazado'?'#fef2f2':it.calidad==='observado'?'#fffbeb':'#f0fdf4'}}>
                      <option value="ok">OK</option>
                      <option value="observado">Observado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </td>
                  <td style={{padding:'8px 12px',width:90,textAlign:'center'}}>
                    <span style={{
                      fontWeight:700,fontSize:13,
                      color:it.diferencia===0?'#6b7280':it.diferencia>0?'#059669':'#dc2626',
                      background:it.diferencia===0?'#f3f4f6':it.diferencia>0?'#f0fdf4':'#fef2f2',
                      padding:'3px 10px',borderRadius:20,display:'inline-block'
                    }}>
                      {it.diferencia>0?'+':''}{it.diferencia}
                    </span>
                  </td>
                  <td style={{padding:'8px 8px'}}>
                    <button onClick={()=>setItems(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:14}}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {items.some(it=>it.diferencia!==0)&&(
        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:700,color:'#92400e',fontSize:13,marginBottom:6}}>Diferencias detectadas:</div>
          {items.filter(it=>it.diferencia!==0).map((it,i)=>(
            <div key={i} style={{fontSize:12,color:'#78350f',padding:'2px 0'}}>
              <strong>{it.nombre}</strong>: esperado {it.cantidadEsperada} {it.unidad}, recibido {it.cantidadRecibida} {it.unidad}
              <span style={{color:it.diferencia>0?'#059669':'#dc2626',fontWeight:700}}> ({it.diferencia>0?'+':''}{it.diferencia})</span>
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={()=>setVista('lista')} style={{padding:'10px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
        <button onClick={confirmarRecepcion} disabled={saving} style={{padding:'10px 28px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>
          Confirmar recepcion y actualizar stock
        </button>
      </div>
    </section>
  );

  // VISTA LISTA
  return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Recepcion de Mercaderia</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Confirmacion guiada de llegadas + actualizacion automatica de stock</p>
        </div>
        <button onClick={iniciarManual} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Recepcion manual</button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Pedidos pendientes */}
      {pendientes.length>0&&(
        <div style={{marginBottom:24}}>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Pedidos pendientes de recepcion ({pendientes.length})</h3>
          <div style={{display:'grid',gap:8}}>
            {pendientes.map(ped=>(
              <div key={ped.id} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a'}}>{ped.productName||ped.nombre}</div>
                  <div style={{fontSize:12,color:'#666',marginTop:2}}>
                    {ped.supplierName&&<span>🏭 {ped.supplierName} · </span>}
                    <span>{ped.qty||ped.cantidad} {ped.unit||ped.unidad}</span>
                    {ped.expectedDate&&<span> · Esperado: {ped.expectedDate}</span>}
                  </div>
                </div>
                <button onClick={()=>iniciarRecepcion(ped)} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
                  Recibir mercaderia
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length===0&&(
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'16px 20px',marginBottom:20,fontSize:13,color:G}}>
          No hay pedidos pendientes. Podés hacer una recepcion manual de cualquier mercaderia.
        </div>
      )}

      {/* Historial */}
      {recepciones.length>0&&(
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Historial de recepciones ({recepciones.length})</h3>
          <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                  {['Fecha','Proveedor','Remito','Items','Diferencias','Estado'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recepciones.map((rec,i)=>(
                  <tr key={rec.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px',fontWeight:500}}>{rec.fecha}</td>
                    <td style={{padding:'10px 14px',color:'#374151'}}>{rec.proveedor||'-'}</td>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{rec.nroRemito||'-'}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:G}}>{rec.items?.length||0} productos</td>
                    <td style={{padding:'10px 14px'}}>
                      {rec.diferencias>0?(
                        <span style={{background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{rec.diferencias} diferencias</span>
                      ):(
                        <span style={{background:'#f0fdf4',color:G,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>Sin diferencias</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{background:'#f0fdf4',color:G,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>Completada</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default RecepcionTab;

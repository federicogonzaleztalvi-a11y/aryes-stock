import { sendLowStockAlert } from './EmailConfigTab.jsx';
import { dbWriteWithRetry } from './catalog-data.js';
import { useState } from 'react';
import { LS, db } from '../../lib/constants.js';

 
const MovementsTab=({products,setProducts,session})=>{
  const [movements,setMovements]=useState(()=>LS.get('aryes-movements',[]));
  const [form,setForm]=useState({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';

  const reasons={
    entrada:['compra','devolucion_cliente','ajuste_positivo','produccion'],
    salida:['venta','devolucion_proveedor','ajuste_negativo','merma','muestra']
  };
  const reasonLabel={
    compra:'Compra a proveedor',devolucion_cliente:'Devolución de cliente',
    ajuste_positivo:'Ajuste positivo',produccion:'Producción interna',
    venta:'Venta',devolucion_proveedor:'Devolución a proveedor',
    ajuste_negativo:'Ajuste negativo',merma:'Merma / vencimiento',muestra:'Muestra'
  };

  const filtered = movements
    .filter(m => filter==='all' ? true : m.type===filter)
    .filter(m => !search || m.productName.toLowerCase().includes(search.toLowerCase()) || (m.reference||'').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const save=async ()=>{
    if(!form.productId||!form.qty||Number(form.qty)<=0){setMsg('Completá producto y cantidad');return;}
    const prod=products.find(p=>p.id===Number(form.productId));
    if(!prod){setMsg('Producto no encontrado');return;}
    const qty=Number(form.qty);
    if(form.type==='salida'&&qty>(prod.stock||0)){setMsg('Stock insuficiente: disponible '+(prod.stock||0)+' '+(prod.unit||'')+' — solicitado '+qty);return;}
    const newStock=form.type==='entrada'?(prod.stock||0)+qty:(prod.stock||0)-qty;
    const mov={
      id:'mov-'+Date.now(),
      productId:prod.id,productName:prod.name,brand:prod.brand||'',
      type:form.type,qty,
      stockBefore:prod.stock||0,stockAfter:newStock,
      reason:form.reason,reference:form.reference,notes:form.notes,
      user:session.name||session.username||'',
      date:new Date().toISOString()
    };
    // Save movement
    const updatedMovs=[mov,...movements];
    LS.set('aryes-movements',updatedMovs);setMovements(updatedMovs);
    // Update product stock
    const updatedProds=products.map(p=>p.id===prod.id?{...p,stock:newStock}:p);
    const now=new Date().toISOString();
    // Use RPC for stock changes (ledger inmutable — no direct stock writes)
    const diff = newStock - (prod.stock || 0);
    if (diff > 0) {
      try { await fetch(SB_URL+'/rest/v1/rpc/stock_recepcion', { method:'POST', headers:{ apikey:SKEY, Authorization:'Bearer '+SKEY, 'Content-Type':'application/json' }, body:JSON.stringify({ p_product_uuid: prod.uuid || prod.id, p_qty: diff, p_org_id: getOrgId(), p_ref: 'manual_adjustment' }) }); } catch(e) { console.warn('[MovementsTab] RPC fallback:', e); }
    } else if (diff < 0) {
      try { await fetch(SB_URL+'/rest/v1/rpc/stock_venta', { method:'POST', headers:{ apikey:SKEY, Authorization:'Bearer '+SKEY, 'Content-Type':'application/json' }, body:JSON.stringify({ p_product_uuid: prod.uuid || prod.id, p_qty: Math.abs(diff), p_org_id: getOrgId(), p_ref: 'manual_adjustment' }) }); } catch(e) { console.warn('[MovementsTab] RPC fallback:', e); }
    }
    setProducts(updatedProds);
    LS.set('aryes6-products',updatedProds);
    // Check low stock alert
    if(newStock<(prod.minStock||5)){
      const alreadySent=LS.get('aryes-alerts-sent',{});
      if(!alreadySent[prod.id]){
        sendLowStockAlert(prod,newStock);
        alreadySent[prod.id]=new Date().toISOString();
        LS.set('aryes-alerts-sent',alreadySent);
      }
    } else {
      // Reset alert flag when stock is restored
      const alreadySent=LS.get('aryes-alerts-sent',{});
      delete alreadySent[prod.id];
      LS.set('aryes-alerts-sent',alreadySent);
    }
    setForm({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
    setMsg((form.type==='entrada'?'✓ Entrada':'✓ Salida')+' registrada — stock actualizado');
    setTimeout(()=>setMsg(''),3000);
  };

  // Stats
  const today=new Date().toISOString().split('T')[0];
  const todayMovs=movements.filter(m=>m.date.startsWith(today));
  const entradas=movements.filter(m=>m.type==='entrada').reduce((s,m)=>s+m.qty,0);
  const salidas=movements.filter(m=>m.type==='salida').reduce((s,m)=>s+m.qty,0);

  return(
    <div style={{padding:'32px 40px',maxWidth:920}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Trazabilidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Movimientos de Stock</h1>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        {[
          {label:'Total movimientos',value:movements.length,color:'#3a3a38',bg:'#f9f9f7'},
          {label:'Entradas acumuladas',value:entradas,color:'#16a34a',bg:'#f0fdf4'},
          {label:'Salidas acumuladas',value:salidas,color:'#dc2626',bg:'#fef2f2'},
          {label:'Movimientos hoy',value:todayMovs.length,color:'#2563eb',bg:'#eff6ff'},
        ].map(({label,value,color,bg})=>(
          <div key={label} style={{flex:1,minWidth:140,background:bg,borderRadius:10,padding:'14px 18px'}}>
            <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>{label}</div>
            <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#1a8a3c':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13,fontWeight:500}}>{msg}</div>}

      {/* Register movement form */}
      {canEdit&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a18',marginBottom:16}}>Registrar movimiento</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={form.productId} onChange={e=>setForm(f=>({...f,productId:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar producto...</option>
                {[...products].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>(
                  <option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name} (stock: {p.stock||0} {p.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Tipo</label>
              <div style={{display:'flex',gap:8}}>
                {['entrada','salida'].map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,type:t,reason:t==='entrada'?'compra':'venta'}))}
                    style={{flex:1,padding:'9px',border:'2px solid '+(form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#e2e2de'),borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                    background:form.type===t?(t==='entrada'?'#f0fdf4':'#fef2f2'):'#fff',
                    color:form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#6a6a68'}}>
                    {t==='entrada'?'↑ Entrada':'↓ Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Cantidad</label>
              <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} placeholder="0" min="0" step="0.01"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Motivo</label>
              <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                {(reasons[form.type]||[]).map(r=><option key={r} value={r}>{reasonLabel[r]}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Referencia (Factura / OC)</label>
              <input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="Ej: FC-001, OC-023"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Notas</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
          </div>
          {form.productId&&form.qty&&(
            <div style={{padding:'10px 14px',background:'#f9f9f7',borderRadius:8,fontSize:13,color:'#6a6a68',marginBottom:12}}>
              Stock actual: <strong>{products.find(p=>p.id===Number(form.productId))?.stock||0}</strong>
              {' → '}
              <strong style={{color:form.type==='entrada'?'#16a34a':'#dc2626'}}>
                {form.type==='entrada'
                  ?(products.find(p=>p.id===Number(form.productId))?.stock||0)+Number(form.qty||0)
                  :Math.max(0,(products.find(p=>p.id===Number(form.productId))?.stock||0)-Number(form.qty||0))
                }
              </strong>
              {' '}{products.find(p=>p.id===Number(form.productId))?.unit||''}
            </div>
          )}
          <button onClick={save} style={{padding:'10px 24px',background:form.type==='entrada'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {form.type==='entrada'?'↑ Registrar entrada':'↓ Registrar salida'}
          </button>
        </div>
      )}

      {/* Filters + list */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o referencia..."
          style={{flex:1,minWidth:200,padding:'8px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        {['all','entrada','salida'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'7px 14px',background:filter===f?'#1a1a18':'#f0f0ec',color:filter===f?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            {f==='all'?'Todos':f==='entrada'?'↑ Entradas':'↓ Salidas'}
          </button>
        ))}
        <button onClick={()=>{
          const csv=['Fecha,Producto,Marca,Tipo,Cantidad,Stock Antes,Stock Después,Motivo,Referencia,Usuario',
            ...filtered.map(m=>[new Date(m.date).toLocaleString('es-UY'),m.productName,m.brand,m.type,m.qty,m.stockBefore,m.stockAfter,m.reason,m.reference||'',m.user].join(','))
          ].join('\n');
          const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
          a.download='movimientos.csv';a.click();
        }} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          ⬇ Exportar CSV
        </button>
      </div>

      {filtered.length===0
        ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>No hay movimientos registrados todavía</div></div>
        :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9f9f7'}}>
              {['Fecha','Producto','Tipo','Cantidad','Stock','Motivo','Ref.','Usuario'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,50).map(m=>(
                <tr key={m.id} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 12px',color:'#9a9a98',whiteSpace:'nowrap'}}>{new Date(m.date).toLocaleDateString('es-UY')} {new Date(m.date).toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{padding:'9px 12px'}}><div style={{fontWeight:600,color:'#1a1a18'}}>{m.productName}</div><div style={{fontSize:11,color:'#9a9a98'}}>{m.brand}</div></td>
                  <td style={{padding:'9px 12px'}}><span style={{padding:'3px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:m.type==='entrada'?'#f0fdf4':'#fef2f2',color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'↑ Entrada':'↓ Salida'}</span></td>
                  <td style={{padding:'9px 12px',fontWeight:700,color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'+':'-'}{m.qty}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.stockBefore} → <strong>{m.stockAfter}</strong></td>
                  <td style={{padding:'9px 12px',color:'#6a6a68'}}>{reasonLabel[m.reason]||m.reason}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.reference||'—'}</td>
                  <td style={{padding:'9px 12px',color:'#9a9a98',fontSize:12}}>{m.user||'—'}</td>
                </tr>
              ))}
              {filtered.length>50&&<tr><td colSpan={8} style={{padding:'10px',textAlign:'center',color:'#9a9a98',fontSize:12}}>Mostrando 50 de {filtered.length} movimientos — exportá CSV para ver todos</td></tr>}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
};



export { MovementsTab };

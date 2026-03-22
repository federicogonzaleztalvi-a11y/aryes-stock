import { useState } from 'react';
import { LS, db } from '../lib/constants.js';

function VentasTab({ products: prodsProp, setProducts: setProdsProp, addMov }){
  const G="#3a7d1e";
  const KVEN="aryes-ventas";
  const KCLI="aryes-clients";
  const KPROD="aryes6-products";
  const ESTADOS={pendiente:'#f59e0b',confirmada:'#3b82f6',preparada:'#8b5cf6',entregada:'#3a7d1e',cancelada:'#ef4444'};

  // Use products from App if passed, else fallback to LS
  const [ventasLocal,setVentasLocal]=useState(()=>LS.get(KVEN,[]));
  const [clientes,setClientes]=useState(()=>LS.get(KCLI,[]));
  const prodsState = prodsProp || [];
  const setProds = setProdsProp || (()=>{});

  const [ventas,setVentasState]=[ventasLocal,(upd)=>{setVentasLocal(upd);LS.set(KVEN,upd);}];
  const setVentas=(upd)=>{setVentasLocal(upd);LS.set(KVEN,upd);};

  const [vista,setVista]=useState('lista');
  const [ventaSel,setVentaSel]=useState(null);
  const [msg,setMsg]=useState({text:'',type:'ok'});
  const [filtroEstado,setFiltroEstado]=useState('todos');
  const [busqueda,setBusqueda]=useState('');

  const showMsg=(text,type='ok')=>{setMsg({text,type});setTimeout(()=>setMsg({text:'',type:'ok'}),4000);};

  // Form state
  const emptyForm={clienteId:'',clienteNombre:'',fecha:new Date().toISOString().split('T')[0],items:[],notas:'',descuento:0};
  const [form,setForm]=useState(emptyForm);
  const [itemProd,setItemProd]=useState('');
  const [itemCant,setItemCant]=useState(1);
  const [itemPrecio,setItemPrecio]=useState(0);
  const [saving,setSaving]=useState(false);
  const [showNewClient,setShowNewClient]=useState(false);
  const [newClientNombre,setNewClientNombre]=useState('');

  const totalVenta=(items,desc=0)=>{
    const sub=items.reduce((a,it)=>a+Number(it.cantidad)*Number(it.precioUnit),0);
    return sub*(1-Number(desc)/100);
  };

  const waLink=(tel,msg)=>`https://wa.me/${(tel||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
  const waMensaje=(nombre,tipo,det)=>`Hola ${nombre||''}! ${tipo==='entrega'?`Confirmamos que ${det}.`:`Su pedido ha sido actualizado: ${det}.`} Gracias por su confianza.`;

  const agregarItem=()=>{
    if(!itemProd||Number(itemCant)<=0)return;
    const prod=prodsState.find(p=>String(p.id)===String(itemProd));
    if(!prod)return;
    const alreadyInCart=form.items.filter(i=>String(i.productoId)===String(prod.id)).reduce((s,i)=>s+(i.cantidad||0),0);
    const disponible=(prod.stock||0)-alreadyInCart;
    if(disponible < Number(itemCant)){
      showMsg(`Stock insuficiente. Disponible: ${disponible} ${prod.unit||'u'}`,'err');return;
    }
    const precio=itemPrecio>0?itemPrecio:(prod.precioVenta||prod.precio||prod.price||0);
    setForm(f=>({...f,items:[...f.items,{
      productoId:prod.id,
      nombre:prod.nombre||prod.name,
      cantidad:Number(itemCant),
      precioUnit:Number(precio),
      unidad:prod.unit||prod.unidad||'u',
      subtotal:Number(itemCant)*Number(precio)
    }]}));
    setItemProd('');setItemCant(1);setItemPrecio(0);
  };

  const addNewClientInline=()=>{
    if(!newClientNombre.trim())return;
    const cli={id:crypto.randomUUID(),nombre:newClientNombre.trim(),tipo:'Otro',creado:new Date().toISOString()};
    const updCli=[...clientes,cli];
    setClientes(updCli);LS.set(KCLI,updCli);
    setForm(f=>({...f,clienteId:cli.id,clienteNombre:cli.nombre}));
    setNewClientNombre('');setShowNewClient(false);
  };

  const guardarVenta=async()=>{
    if(saving)return;
    if(!form.clienteId&&!form.clienteNombre){showMsg('Seleccioná un cliente','err');return;}
    if(form.items.length===0){showMsg('Agregá al menos un producto','err');return;}

    // STOCK VALIDATION at save time
    const stockErrors=[];
    const updProds=[...prodsState];
    form.items.forEach(it=>{
      const idx=updProds.findIndex(p=>String(p.id)===String(it.productoId));
      if(idx>-1){
        if(Number(it.cantidad)>Number(updProds[idx].stock||0)){
          stockErrors.push(`Stock insuficiente: ${it.nombre} — disponible ${updProds[idx].stock||0}, solicitado ${it.cantidad}`);
        }
      }
    });
    if(stockErrors.length>0){showMsg(stockErrors[0],'err');return;}

    setSaving(true);
    try{
      const cl=clientes.find(c=>String(c.id)===String(form.clienteId));
      const venta={
        ...form,
        id:crypto.randomUUID(),
        clienteNombre:cl?.nombre||form.clienteNombre,
        total:totalVenta(form.items,form.descuento),
        estado:'pendiente',
        nroVenta:'V-'+String(ventas.length+1).padStart(4,'0'),
        creadoEn:new Date().toISOString()
      };

      // DESCUENTA STOCK INMEDIATAMENTE al crear la venta
      const now=new Date().toISOString();
      form.items.forEach(it=>{
        const idx=updProds.findIndex(p=>String(p.id)===String(it.productoId));
        if(idx>-1){
          const newStock=Math.max(0,Number(updProds[idx].stock||0)-Number(it.cantidad));
          updProds[idx]={...updProds[idx],stock:newStock,updatedAt:now};
        }
      });
      setProds(updProds);LS.set(KPROD,updProds);

      // Persist stock to Supabase for each product
      const stockWrites=form.items.map(it=>
        db.patch('products',{stock:updProds.find(p=>String(p.id)===String(it.productoId))?.stock,updated_at:now},'uuid=eq.'+it.productoId)
          .catch(e=>console.warn('[Aryes] venta stock patch failed',it.productoId,e))
      );
      await Promise.allSettled(stockWrites);

      // Register movements for each item
      if(addMov){
        form.items.forEach(it=>{
          addMov({type:'venta',productId:it.productoId,productName:it.nombre,supplierId:'',supplierName:'',qty:it.cantidad,unit:it.unidad,stockAfter:updProds.find(p=>String(p.id)===String(it.productoId))?.stock,note:`Venta ${venta.nroVenta} — ${cl?.nombre||venta.clienteNombre}`});
        });
      }

      // Persist venta to Supabase
      try{
        await db.insert('ventas',{
          id:venta.id,nro_venta:venta.nroVenta,
          cliente_id:venta.clienteId||null,cliente_nombre:venta.clienteNombre||null,
          items:venta.items,total:venta.total,descuento:venta.descuento||0,
          estado:venta.estado,notas:venta.notas||null,
          fecha_entrega:venta.fechaEntrega||null,creado_en:venta.creadoEn,
        });
      }catch(e){console.warn('[Aryes] venta SB insert failed',e);}

      // Audit log
      try{await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,
        user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),
        action:'venta_creada',detail:JSON.stringify({id:venta.id,nroVenta:venta.nroVenta,clienteNombre:venta.clienteNombre,total:venta.total})
      });}catch(e){}

      const upd=[venta,...ventas];
      setVentas(upd);
      setForm(emptyForm);setVista('lista');
      showMsg(`✓ Venta ${venta.nroVenta} creada — stock descontado`,'ok');
    }finally{setSaving(false);}
  };

  const cambiarEstado=(id,estado)=>{
    const venta=ventas.find(v=>v.id===id);
    const upd=ventas.map(v=>v.id===id?{...v,estado,updatedAt:new Date().toISOString()}:v);
    setVentas(upd);
    if(ventaSel?.id===id)setVentaSel({...ventaSel,estado});
    // Persist estado to Supabase
    db.patch('ventas',{estado,updated_at:new Date().toISOString()},'id=eq.'+id).catch(e=>console.warn('[Aryes] venta estado patch failed',e));
    if(estado==='cancelada'&&venta&&venta.estado!=='cancelada'){
      // Restore stock on cancel
      const updProds=[...prodsState];
      const now=new Date().toISOString();
      venta.items?.forEach(it=>{
        const idx=updProds.findIndex(p=>String(p.id)===String(it.productoId));
        if(idx>-1){
          const restoredStock=Number(updProds[idx].stock||0)+Number(it.cantidad);
          updProds[idx]={...updProds[idx],stock:restoredStock,updatedAt:now};
          db.patch('products',{stock:restoredStock,updated_at:now},'uuid=eq.'+it.productoId).catch(()=>{});
        }
      });
      setProds(updProds);LS.set(KPROD,updProds);
      showMsg('Venta cancelada — stock restaurado','ok');
    } else if(estado==='entregada'){
      const cl=clientes.find(c=>String(c.id)===String(venta?.clienteId));
      const tel=cl?.telefono||'';
      if(tel){
        const det=`su pedido ${venta?.nroVenta} fue entregado hoy ${new Date().toLocaleDateString('es-UY')}`;
        const link=waLink(tel,waMensaje(venta?.clienteNombre||cl?.nombre,'entrega',det));
        setMsg({text:'ENTREGADA:'+link+':'+venta?.clienteNombre,type:'wa'});
      } else {
        showMsg('Venta marcada como entregada','ok');
      }
    } else {
      showMsg('Estado actualizado: '+estado,'ok');
    }
  };

  const ventasFiltradas=ventas.filter(v=>{
    if(filtroEstado!=='todos'&&v.estado!==filtroEstado)return false;
    if(busqueda&&!v.clienteNombre?.toLowerCase().includes(busqueda.toLowerCase())&&!v.nroVenta?.toLowerCase().includes(busqueda.toLowerCase()))return false;
    return true;
  });

  const totalMes=ventas.filter(v=>{
    const d=new Date(v.creadoEn);const now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&v.estado!=='cancelada';
  }).reduce((a,v)=>a+Number(v.total||0),0);

  const inp={padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box',background:'#fff'};

  const MsgBanner=()=>{
    if(!msg.text)return null;
    if(msg.type==='wa'){
      const [,link,nombre]=msg.text.split(':');
      return(
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <span style={{color:G,fontSize:13,fontWeight:600}}>Venta entregada. ¿Notificar a {nombre||'cliente'}?</span>
          <a href={link} target='_blank' rel='noreferrer' style={{background:'#25d366',color:'#fff',padding:'8px 18px',borderRadius:8,fontWeight:700,fontSize:13,textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>📩 Enviar WhatsApp</a>
        </div>
      );
    }
    const isErr=msg.type==='err';
    return <div style={{background:isErr?'#fef2f2':'#f0fdf4',border:`1px solid ${isErr?'#fecaca':'#bbf7d0'}`,borderRadius:8,padding:'10px 16px',marginBottom:16,color:isErr?'#dc2626':G,fontSize:13}}>{msg.text}</div>;
  };

  // FORM VIEW
  if(vista==='form')return(
    <section style={{padding:'28px 36px',maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>←</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Nueva orden de venta</h2>
      </div>
      <MsgBanner/>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
          {/* CLIENTE — siempre desde lista */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cliente</label>
            <select value={form.clienteId} onChange={e=>{const cl=clientes.find(c=>String(c.id)===e.target.value);setForm(f=>({...f,clienteId:e.target.value,clienteNombre:cl?.nombre||''}));setShowNewClient(false);}} style={inp}>
              <option value=''>— Seleccionar cliente —</option>
              {clientes.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {!showNewClient
              ?<button onClick={()=>setShowNewClient(true)} style={{marginTop:6,background:'none',border:'none',color:G,fontSize:11,cursor:'pointer',padding:0,fontWeight:600}}>+ Agregar cliente nuevo</button>
              :<div style={{display:'flex',gap:6,marginTop:6}}>
                <input value={newClientNombre} onChange={e=>setNewClientNombre(e.target.value)} placeholder='Nombre del cliente' style={{...inp,flex:1,padding:'6px 8px'}}
                  onKeyDown={e=>e.key==='Enter'&&addNewClientInline()}/>
                <button onClick={addNewClientInline} style={{padding:'6px 12px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>OK</button>
                <button onClick={()=>setShowNewClient(false)} style={{padding:'6px 10px',background:'none',border:'1px solid #e5e7eb',borderRadius:6,cursor:'pointer',fontSize:12}}>✕</button>
              </div>
            }
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type='date' style={inp} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Descuento %</label>
            <input type='number' style={inp} value={form.descuento} onChange={e=>setForm(f=>({...f,descuento:e.target.value}))} min='0' max='100'/>
          </div>
        </div>

        {/* Agregar producto */}
        <div style={{background:'#f9fafb',borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'#666',marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Agregar producto</div>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:3,minWidth:200}}>
              <select value={itemProd} onChange={e=>{setItemProd(e.target.value);const p=prodsState.find(x=>String(x.id)===e.target.value);if(p)setItemPrecio(p.precioVenta||p.precio||p.price||0);}} style={inp}>
                <option value=''>— Producto —</option>
                {prodsState.filter(p=>(p.stock||0)>0).sort((a,b)=>(a.nombre||a.name||'').localeCompare(b.nombre||b.name||'')).map(p=><option key={p.id} value={p.id}>{p.nombre||p.name} — stock: {p.stock} {p.unit||''}</option>)}
              </select>
            </div>
            <div style={{width:90}}><input type='number' placeholder='Cant.' value={itemCant} onChange={e=>setItemCant(e.target.value)} style={inp} min='1'/></div>
            <div style={{width:110}}><input type='number' placeholder='Precio u.' value={itemPrecio} onChange={e=>setItemPrecio(e.target.value)} style={inp} min='0'/></div>
            <button onClick={agregarItem} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Agregar</button>
          </div>
        </div>

        {form.items.length>0&&(
          <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb',marginBottom:14}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9fafb'}}>{['Producto','Cant.','Precio u.','Subtotal',''].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}</tr></thead>
              <tbody>
                {form.items.map((it,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6'}}>
                    <td style={{padding:'9px 12px',fontWeight:500}}>{it.nombre}</td>
                    <td style={{padding:'9px 12px'}}>{it.cantidad} {it.unidad}</td>
                    <td style={{padding:'9px 12px',color:'#6b7280'}}>${Number(it.precioUnit).toLocaleString('es-UY')}</td>
                    <td style={{padding:'9px 12px',fontWeight:700,color:G}}>${(it.cantidad*it.precioUnit).toLocaleString('es-UY')}</td>
                    <td style={{padding:'9px 8px'}}><button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626'}}>✕</button></td>
                  </tr>
                ))}
                {Number(form.descuento)>0&&(
                  <tr style={{borderTop:'1px solid #e5e7eb',background:'#fffbeb'}}>
                    <td colSpan='3' style={{padding:'8px 12px',textAlign:'right',color:'#92400e',fontWeight:600}}>Descuento {form.descuento}%</td>
                    <td style={{padding:'8px 12px',color:'#92400e',fontWeight:700}}>-${(form.items.reduce((a,it)=>a+it.cantidad*it.precioUnit,0)*form.descuento/100).toLocaleString('es-UY')}</td>
                    <td></td>
                  </tr>
                )}
                <tr style={{borderTop:'2px solid #e5e7eb',background:'#f0fdf4'}}>
                  <td colSpan='3' style={{padding:'10px 12px',textAlign:'right',fontWeight:700}}>TOTAL</td>
                  <td style={{padding:'10px 12px',fontWeight:800,color:G,fontSize:16}}>${totalVenta(form.items,form.descuento).toLocaleString('es-UY')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Notas</label>
          <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{padding:'10px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
        <button onClick={guardarVenta} disabled={saving} style={{padding:'10px 28px',background:saving?'#9ca3af':G,color:'#fff',border:'none',borderRadius:8,cursor:saving?'not-allowed':'pointer',fontWeight:700,fontSize:14}}>
          {saving?'Guardando…':'Crear orden de venta'}
        </button>
      </div>
    </section>
  );

  // DETALLE
  if(vista==='detalle'&&ventaSel){
    const v=ventas.find(x=>x.id===ventaSel.id)||ventaSel;
    return(
      <section style={{padding:'28px 36px',maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>←</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#1a1a1a',margin:0}}>{v.nroVenta} — {v.clienteNombre}</h2>
            <p style={{fontSize:12,color:'#888',margin:'2px 0 0'}}>{v.fecha}</p>
          </div>
          <span style={{background:ESTADOS[v.estado]||'#6b7280',color:'#fff',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,textTransform:'capitalize'}}>{v.estado}</span>
        </div>
        <MsgBanner/>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {v.estado==='pendiente'&&<button onClick={()=>cambiarEstado(v.id,'confirmada')} style={{padding:'7px 16px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Confirmar</button>}
          {v.estado==='confirmada'&&<button onClick={()=>cambiarEstado(v.id,'preparada')} style={{padding:'7px 16px',background:'#8b5cf6',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Marcar preparada</button>}
          {(v.estado==='preparada'||v.estado==='confirmada')&&<button onClick={()=>cambiarEstado(v.id,'entregada')} style={{padding:'7px 16px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Marcar entregada</button>}
          {v.estado!=='cancelada'&&v.estado!=='entregada'&&<button onClick={()=>cambiarEstado(v.id,'cancelada')} style={{padding:'7px 16px',border:'1px solid #fecaca',background:'#fff',color:'#dc2626',borderRadius:8,cursor:'pointer',fontSize:12}}>Cancelar (restaura stock)</button>}
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>{['Producto','Cant.','Precio u.','Subtotal'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}</tr></thead>
            <tbody>
              {v.items?.map((it,i)=>(
                <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'10px 14px',fontWeight:500}}>{it.nombre}</td>
                  <td style={{padding:'10px 14px'}}>{it.cantidad} {it.unidad}</td>
                  <td style={{padding:'10px 14px',color:'#6b7280'}}>${Number(it.precioUnit).toLocaleString('es-UY')}</td>
                  <td style={{padding:'10px 14px',fontWeight:700,color:G}}>${(it.cantidad*it.precioUnit).toLocaleString('es-UY')}</td>
                </tr>
              ))}
              {Number(v.descuento)>0&&(
                <tr style={{background:'#fffbeb',borderTop:'1px solid #e5e7eb'}}>
                  <td colSpan='3' style={{padding:'8px 14px',textAlign:'right',color:'#92400e',fontWeight:600}}>Descuento {v.descuento}%</td>
                  <td style={{padding:'8px 14px',color:'#92400e',fontWeight:700}}>-${(v.items?.reduce((a,it)=>a+it.cantidad*it.precioUnit,0)*v.descuento/100).toLocaleString('es-UY')}</td>
                </tr>
              )}
              <tr style={{borderTop:'2px solid #e5e7eb',background:'#f0fdf4'}}>
                <td colSpan='3' style={{padding:'12px 14px',textAlign:'right',fontWeight:700}}>TOTAL</td>
                <td style={{padding:'12px 14px',fontWeight:800,color:G,fontSize:18}}>${Number(v.total).toLocaleString('es-UY')}</td>
              </tr>
            </tbody>
          </table>
          {v.notas&&<div style={{marginTop:14,padding:'10px 14px',background:'#fffbeb',borderRadius:8,fontSize:13,color:'#92400e'}}>Notas: {v.notas}</div>}
        </div>
      </section>
    );
  }

  // LISTA
  return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Órdenes de Venta</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Gestión de ventas a clientes — remitos y estado de entrega</p>
        </div>
        <button onClick={()=>{setClientes(LS.get(KCLI,[]));setForm(emptyForm);setVista('form');}} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nueva venta</button>
      </div>
      <MsgBanner/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {l:'Total ventas',v:ventas.length,c:'#6b7280'},
          {l:'Pendientes',v:ventas.filter(v=>v.estado==='pendiente').length,c:'#f59e0b'},
          {l:'En preparación',v:ventas.filter(v=>v.estado==='preparada'||v.estado==='confirmada').length,c:'#8b5cf6'},
          {l:'Facturado este mes',v:'$'+totalMes.toLocaleString('es-UY'),c:G},
        ].map(s=>(
          <div key={s.l} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder='Buscar cliente o N° venta...' style={{padding:'7px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',flex:1,minWidth:200}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['todos','pendiente','confirmada','preparada','entregada','cancelada'].map(est=>(
            <button key={est} onClick={()=>setFiltroEstado(est)} style={{padding:'6px 12px',borderRadius:20,border:'2px solid '+(filtroEstado===est?(ESTADOS[est]||G):'#e5e7eb'),background:filtroEstado===est?(ESTADOS[est]||G):'#fff',color:filtroEstado===est?'#fff':'#666',fontWeight:600,fontSize:11,cursor:'pointer',textTransform:'capitalize'}}>
              {est==='todos'?'Todos':est}
            </button>
          ))}
        </div>
      </div>
      {ventasFiltradas.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <p>{ventas.length===0?'No hay órdenes de venta aún':'Sin resultados para este filtro'}</p>
          <button onClick={()=>{setForm(emptyForm);setVista('form');}} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Crear primera venta</button>
        </div>
      ):(
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['N° Orden','Cliente','Fecha','Productos','Total','Estado',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.map((v,i)=>(
                <tr key={v.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa',cursor:'pointer'}} onClick={()=>{setVentaSel(v);setVista('detalle');}}>
                  <td style={{padding:'11px 14px',fontFamily:'monospace',fontWeight:700,color:G,fontSize:12}}>{v.nroVenta}</td>
                  <td style={{padding:'11px 14px',fontWeight:600}}>{v.clienteNombre}</td>
                  <td style={{padding:'11px 14px',color:'#6b7280'}}>{v.fecha}</td>
                  <td style={{padding:'11px 14px',color:'#6b7280'}}>{v.items?.length||0} prod.</td>
                  <td style={{padding:'11px 14px',fontWeight:700,color:G}}>${Number(v.total||0).toLocaleString('es-UY')}</td>
                  <td style={{padding:'11px 14px'}}><span style={{background:ESTADOS[v.estado]||'#6b7280',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,textTransform:'capitalize'}}>{v.estado}</span></td>
                  <td style={{padding:'11px 10px'}}><button onClick={e=>{e.stopPropagation();setVentaSel(v);setVista('detalle');}} style={{background:G,color:'#fff',border:'none',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export default VentasTab;

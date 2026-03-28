import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db, SB_URL, SKEY, getAuthHeaders } from '../lib/constants.js';
import ModalCobro from './facturacion/ModalCobro.jsx';
import ModalFactura from './facturacion/ModalFactura.jsx';
import RemitoPDF from '../components/RemitoPDF.jsx';
import PedidosPortalPanel from '../components/PedidosPortalPanel.jsx';

// ── fetchNextNroVenta — calls Postgres sequence via RPC ───────────────────────
// Atomic: impossible to produce duplicates regardless of concurrent users.
// Falls back to local Math.max() only if the RPC fails (e.g. offline).
async function fetchNextNroVenta(ventasLocal) {
  try {
    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
    const r = await fetch(`${SB_URL}/rest/v1/rpc/next_nro_venta`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    if (r.ok) {
      const nro = await r.json();
      if (typeof nro === 'string' && nro.startsWith('V-')) return nro;
    }
  } catch { /* fallback below */ }
  // Offline fallback — still better than nothing
  const nums = (ventasLocal || []).map(v => parseInt((v.nroVenta || 'V-0000').replace('V-', '')) || 0);
  return 'V-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

// ── callRpc — invoca una función Postgres SECURITY DEFINER ───────────────────
// Thin wrapper over the Supabase RPC endpoint.
// Returns { data } on success, throws on error with parsed message.
async function callRpc(fnName, params = {}) {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(params),
  });
  if (r.ok) return { data: await r.json() };
  const err = await r.json().catch(() => ({}));
  // Postgres RAISE EXCEPTION messages come through as err.message
  throw new Error(err?.message || err?.hint || `RPC ${fnName} failed (${r.status})`);
}

function VentasTab(){
  const { products, setProducts, addMov, setHasPendingSync, ventas, setVentas,
          clientes, setClientes, priceListas, priceListItems, lotes,
          cfes, setCfes, cobros, setCobros, brandCfg } = useApp();
  const G="#3a7d1e";
  const ESTADOS={pendiente:'#f59e0b',confirmada:'#3b82f6',preparada:'#8b5cf6',entregada:'#3a7d1e',cancelada:'#ef4444'};

  // clientes now reactive from AppContext → no focus refresh needed


  const [vista,setVista]=useState('lista');
  const [ventaSel,setVentaSel]=useState(null);
  const [msg,setMsg]=useState({text:'',type:'ok'});
  const [filtroEstado,setFiltroEstado]=useState('todos');
  const [busqueda,setBusqueda]=useState('');
  const [showCobro,setShowCobro]=useState(false);
  const [cobroPrefill,setCobroPrefill]=useState(null);
  const [showFacturar,setShowFacturar]=useState(false);
  const [facturarVenta,setFacturarVenta]=useState(null);
  const [remitoVenta,setRemitoVenta]=useState(null);

  // Quick-cobro handler → same logic as FacturacionTab.handleSaveCobro
  const handleSaveCobroRapido = (cobro) => {
    const nuevo = { ...cobro, createdAt: new Date().toISOString() };
    setCobros([nuevo, ...cobros]);
    db.upsert('collections', {
      id: nuevo.id || (Math.random().toString(36).slice(2)),
      cliente_id:       nuevo.clienteId   || null,
      monto:            nuevo.monto,
      metodo:           nuevo.metodo,
      fecha:            nuevo.fecha,
      fecha_cheque:     nuevo.fechaCheque || null,
      facturas_aplicar: nuevo.facturasAplicar,
      notas:            nuevo.notas       || '',
      created_at:       nuevo.createdAt,
    }, 'id').catch(e => { console.warn('[VentasTab] cobro upsert failed:', e?.message||e); setHasPendingSync(true); });
    // Update CFE saldo if facturas applied
    if (cfes && cobro.facturasAplicar?.length) {
      // let FacturacionTab handle the saldo update on next render → cobro is persisted
    }
    setShowCobro(false);
    setCobroPrefill(null);
    showMsg('Cobro registrado →');
  };

  const showMsg=(text,type='ok')=>{setMsg({text,type});setTimeout(()=>setMsg({text:'',type:'ok'}),4000);};

  // Form state
  const emptyForm={clienteId:'',clienteNombre:'',fecha:new Date().toISOString().split('T')[0],items:[],notas:'',descuento:0};
  const [form,setForm]=useState(emptyForm);
  const [itemProd,setItemProd]=useState('');
  const [itemCant,setItemCant]=useState(1);
  const [itemPrecio,setItemPrecio]=useState(0);
  const [itemLote,setItemLote]=useState('');  // selected lote id for current item
  const [saving,setSaving]=useState(false);
  const [showNewClient,setShowNewClient]=useState(false);
  const [newClientNombre,setNewClientNombre]=useState('');

  const totalVenta=(items,desc=0)=>{
    const sub=items.reduce((a,it)=>a+Number(it.cantidad)*Number(it.precioUnit),0);
    return sub*(1-Number(desc)/100);
  };
  // eslint-disable-next-line no-unused-vars
  const costoTotal=(items)=>items.reduce((a,it)=>a+Number(it.cantidad)*Number(it.costoUnit||0),0);
  // eslint-disable-next-line no-unused-vars
  const margenPct=(venta,costo)=>venta>0?((venta-costo)/venta*100):0;
  const fmtPct=(n)=>n.toFixed(1)+'%';
  const fmtUSD=(n)=>'$'+Number(n).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2});

  const waLink=(tel,msg)=>`https://wa.me/${(tel||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
  const waMensaje=(nombre,tipo,det)=>`Hola ${nombre||''}! ${tipo==='entrega'?`Confirmamos que ${det}.`:`Su pedido ha sido actualizado: ${det}.`} Gracias por su confianza.`;

  const agregarItem=()=>{
    if(!itemProd||Number(itemCant)<=0)return;
    const prod=products.find(p=>p.id===itemProd);
    if(!prod)return;
    const alreadyInCart=form.items.filter(i=>i.productoId===prod.id).reduce((s,i)=>s+(i.cantidad||0),0);
    const disponible=(prod.stock||0)-alreadyInCart;
    if(disponible < Number(itemCant)){
      showMsg(`Stock insuficiente. Disponible: ${disponible} ${prod.unit||'u'}`,'err');return;
    }
    // →→ Price list resolution →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
    // Priority: 1) manual override 2) custom item price in list 3) list discount 4) precioVenta
    let precio = prod.precioVenta || prod.precio || prod.price || 0;
    if (itemPrecio > 0) {
      precio = itemPrecio; // manual override always wins
    } else {
      const cli = clientes.find(c => c.id === form.clienteId);
      const listaId = cli?.listaId;
      if (listaId) {
        const customItem = priceListItems.find(it => it.listaId === listaId && it.productUuid === prod.id);
        if (customItem && customItem.precio > 0) {
          precio = customItem.precio; // exact custom price for this product in this list
        } else {
          const lista = priceListas.find(l => l.id === listaId);
          if (lista && lista.descuento > 0) {
            precio = Math.round(precio * (1 - lista.descuento / 100)); // global % discount
          }
        }
      }
    }
    setForm(f=>({...f,items:[...f.items,{
      productoId:prod.id,
      nombre:prod.nombre||prod.name,
      cantidad:Number(itemCant),
      precioUnit:Number(precio),
      costoUnit:Number(prod.unitCost||0),
      unidad:prod.unit||prod.unidad||'u',
      subtotal:Number(itemCant)*Number(precio),
      loteId:   itemLote || undefined,
      loteNro:  itemLote ? (lotes.find(l=>l.id===itemLote)?.lote||undefined) : undefined,
    }]}));
    setItemProd('');setItemCant(1);setItemPrecio(0);setItemLote('');
  };

  const addNewClientInline=()=>{
    if(!newClientNombre.trim())return;
    const cli={id:crypto.randomUUID(),nombre:newClientNombre.trim(),tipo:'Otro',creado:new Date().toISOString(),lat:null,lng:null,geocodedAt:null};
    const updCli=[...clientes,cli];
    setClientes(updCli);
    setForm(f=>({...f,clienteId:cli.id,clienteNombre:cli.nombre}));
    setNewClientNombre('');setShowNewClient(false);
  };

  const guardarVenta=async()=>{
    if(saving)return;
    if(!form.clienteId&&!form.clienteNombre){showMsg('Seleccioná un cliente','err');return;}
    if(form.items.length===0){showMsg('Agregá al menos un producto','err');return;}

    // STOCK VALIDATION at save time
    const stockErrors=[];
    const updProds=[...products];
    form.items.forEach(it=>{
      const idx=updProds.findIndex(p=>p.id===it.productoId);
      if(idx>-1){
        if(Number(it.cantidad)>Number(updProds[idx].stock||0)){
          stockErrors.push(`Stock insuficiente: ${it.nombre} → disponible ${updProds[idx].stock||0}, solicitado ${it.cantidad}`);
        }
      }
    });
    if(stockErrors.length>0){showMsg(stockErrors[0],'err');return;}

    // CREDIT LIMIT VALIDATION — Amazon: correctness before committing
    if(form.clienteId){
      const cli = clientes.find(c => c.id === form.clienteId);
      const limite = Number(cli?.limiteCredito || 0);
      if(limite > 0){
        // Sum open CFEs (emitida + cobrado_parcial) for this client
        const deudaActual = cfes
          .filter(c => c.clienteId === form.clienteId && ['emitida','cobrado_parcial'].includes(c.status))
          .reduce((s, c) => s + (c.saldoPendiente || c.total || 0), 0);
        const totalVenta = Number(form.total || 0);
        if(deudaActual + totalVenta > limite){
          const exceso = (deudaActual + totalVenta - limite).toLocaleString('es-UY', {minimumFractionDigits:0});
          const deudaStr = deudaActual.toLocaleString('es-UY', {minimumFractionDigits:0});
          const limiteStr = limite.toLocaleString('es-UY', {minimumFractionDigits:0});
          const proceed = window.confirm(
            `⚠️ Límite de crédito excedido para ${cli.nombre}\n\n` +
            `Deuda actual: U$S ${deudaStr}\n` +
            `Esta venta: U$S ${totalVenta.toLocaleString('es-UY',{minimumFractionDigits:0})}\n` +
            `Límite configurado: U$S ${limiteStr}\n` +
            `Exceso: U$S ${exceso}\n\n` +
            `¿Confirmar venta de todas formas?`
          );
          if(!proceed) return;
        }
      }
    }

    setSaving(true);
    try{
      const cl=clientes.find(c=>c.id===form.clienteId);
      const venta={
        ...form,
        id:crypto.randomUUID(),
        clienteNombre:cl?.nombre||form.clienteNombre,
        total:totalVenta(form.items,form.descuento),
        estado:'pendiente',
        nroVenta: await fetchNextNroVenta(ventas),
        creadoEn:new Date().toISOString()
      };

      // DESCUENTA STOCK INMEDIATAMENTE al crear la venta
      const now=new Date().toISOString();
      // Capture stock BEFORE deduction → needed as lock value for patchWithLock
      const stockBefore=Object.fromEntries(
        form.items.map(it=>[it.productoId, Number(updProds.find(p=>p.id===it.productoId)?.stock||0)])
      );
      form.items.forEach(it=>{
        const idx=updProds.findIndex(p=>p.id===it.productoId);
        if(idx>-1){
          const newStock=Math.max(0,Number(updProds[idx].stock||0)-Number(it.cantidad));
          updProds[idx]={...updProds[idx],stock:newStock,updatedAt:now};
        }
      });
      setProducts(updProds);

      // ── Atomic DB write via create_venta RPC ──────────────────────────────
      // One Postgres transaction: validate stock + deduct + movements + venta + audit.
      // If anything fails, Postgres rolls back everything — no partial state.
      // Optimistic UI above gives immediate feedback; on error we revert.
      try {
        const userEmail = (() => { try { return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'sistema'; } catch { return 'sistema'; } })();
        await callRpc('create_venta', {
          p_id:             venta.id,
          p_nro_venta:      venta.nroVenta,
          p_cliente_id:     venta.clienteId || '',
          p_cliente_nombre: venta.clienteNombre || '',
          p_items:          venta.items,
          p_total:          venta.total,
          p_descuento:      venta.descuento || 0,
          p_notas:          venta.notas || '',
          p_fecha_entrega:  venta.fechaEntrega || '',
          p_creado_en:      venta.creadoEn,
          p_user_email:     userEmail,
        });
      } catch (rpcErr) {
        // RPC failed — revert optimistic UI to keep client consistent with DB
        setProducts(products); // restore pre-optimistic products
        const errMsg = rpcErr?.message || '';
        if (errMsg.includes('insufficient_stock')) {
          const parts = errMsg.split(':');
          showMsg(`Stock insuficiente: ${parts[1]||'producto'} — disponible ${parts[2]||'?'}, solicitado ${parts[3]||'?'}`,'err');
        } else if (errMsg.includes('authentication_required')) {
          showMsg('Sesión expirada. Recargá la página.', 'err');
        } else {
          showMsg('Error al guardar la venta. Verificá tu conexión e intentá de nuevo.', 'err');
          console.error('[VentasTab] create_venta RPC failed:', errMsg);
        }
        setSaving(false);
        return;
      }

      const upd=[venta,...ventas];
      setVentas(upd);
      setForm(emptyForm);setVista('lista');
      showMsg(`→ Venta ${venta.nroVenta} creada → stock descontado`,'ok');
    }finally{setSaving(false);}
  };

  const cambiarEstado=async(id,nuevoEstado)=>{
    const venta=ventas.find(v=>v.id===id);
    const userEmail=(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'sistema';}catch{return 'sistema';}})();
    const sessionToken=(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.access_token||'';}catch{return '';}})();

    // Optimistic update
    const ts=new Date().toISOString();
    const newEntry={from:venta?.estado,to:nuevoEstado,ts,user:userEmail};
    const upd=ventas.map(v=>v.id===id?{...v,estado:nuevoEstado,estadoLog:[...(v.estadoLog||[]),newEntry],updatedAt:ts}:v);
    setVentas(upd);
    if(ventaSel?.id===id)setVentaSel({...ventaSel,estado:nuevoEstado,estadoLog:[...(ventaSel.estadoLog||[]),newEntry]});

    // Call state machine RPC (validates transition server-side)
    try{
      const {SB_URL,SKEY}=await import('../lib/constants.js');
      const r=await fetch(SB_URL+'/rest/v1/rpc/transition_venta_state',{
        method:'POST',
        headers:{apikey:SKEY,Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'},
        body:JSON.stringify({p_venta_id:id,p_new_estado:nuevoEstado,p_user_email:userEmail})
      });
      if(!r.ok){
        const err=await r.json().catch(()=>({}));
        const msg=err?.message||'';
        if(msg.includes('invalid_transition')){
          // Revert optimistic update
          setVentas(ventas);
          if(ventaSel?.id===id)setVentaSel(venta||null);
          showMsg('Transición no permitida: '+venta?.estado+' → '+nuevoEstado,'err');
          return;
        }
        console.warn('[VentasTab] transition RPC failed:',msg);
      }
    }catch(e){
      console.warn('[VentasTab] transition RPC error:',e?.message||e);
    }
    // Handle side effects + auto-notifications (MercadoLibre: transitions generate events)
    const estado=nuevoEstado;

    // Auto WhatsApp when venta goes en_ruta — notify client with tracking info
    if(estado==='en_ruta' && venta?.clienteId){
      const cli = clientes.find(c => c.id === venta.clienteId);
      const tel = (cli?.telefono||'').replace(/[^0-9]/g,'');
      if(tel){
        const nombre = (venta.clienteNombre||'').split(' ')[0];
        const msg    = `Hola ${nombre}, tu pedido ${venta.nroVenta} ya esta en camino. Te avisamos cuando llegue a tu local!`;
        setTimeout(()=>{ window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank'); }, 300);
      }
    }
    if(estado==='cancelada'&&venta&&venta.estado!=='cancelada'){
      // Optimistic UI: restore stock locally immediately
      const updProds=[...products];
      const now=new Date().toISOString();
      venta.items?.forEach(it=>{
        const idx=updProds.findIndex(p=>p.id===it.productoId);
        if(idx>-1){
          const restoredStock=(updProds[idx].stock||0)+Number(it.cantidad);
          updProds[idx]={...updProds[idx],stock:restoredStock,updatedAt:now};
        }
      });
      setProducts(updProds);

      // Atomic DB cancel via RPC
      const userEmail=(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'sistema';}catch{return 'sistema';}})();
      callRpc('cancel_venta',{p_venta_id:id,p_user_email:userEmail})
        .then(()=>{ showMsg('Venta cancelada — stock restaurado','ok'); })
        .catch(e=>{
          // RPC failed — revert optimistic stock restore
          setProducts(products);
          console.error('[VentasTab] cancel_venta RPC failed:',e?.message);
          showMsg('Error al cancelar la venta. Intentá de nuevo.','err');
        });
    } else if(estado==='entregada'){
      const cl=clientes.find(c=>c.id===venta?.clienteId);
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

  // Pre-compute active price list for the selected client (avoids IIFE in JSX)
  const activaLista = (() => {
    if (!form.clienteId) return null;
    const cli = clientes.find(c => c.id === form.clienteId);
    return cli?.listaId ? priceListas.find(l => l.id === cli.listaId) ?? null : null;
  })();

  const MsgBanner=()=>{
    if(!msg.text)return null;
    if(msg.type==='wa'){
      const [,link,nombre]=msg.text.split(':');
      return(
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <span style={{color:G,fontSize:13,fontWeight:600}}>Venta entregada. ¿Notificar a {nombre||'cliente'}?</span>
          <a href={link} target='_blank' rel='noreferrer' style={{background:'#25d366',color:'#fff',padding:'8px 18px',borderRadius:8,fontWeight:700,fontSize:13,textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>📊© Enviar WhatsApp</a>
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
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>→</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Nueva orden de venta</h2>
      </div>
      <MsgBanner/>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
          {/* CLIENTE → siempre desde lista */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cliente</label>
            <select value={form.clienteId} onChange={e=>{const cl=clientes.find(c=>c.id===e.target.value);setForm(f=>({...f,clienteId:e.target.value,clienteNombre:cl?.nombre||''}));setShowNewClient(false);}} style={inp}>
              <option value=''>→ Seleccionar cliente →</option>
              {clientes.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {/* Active price list badge → computed outside JSX */}
            {activaLista&&(
              <div style={{marginTop:5,fontSize:11,fontWeight:700,color:activaLista.color||G,
                background:(activaLista.color||G)+'18',padding:'3px 10px',borderRadius:20,display:'inline-block'}}>
                {activaLista.nombre} · →{activaLista.descuento}%
              </div>
            )}
            {!showNewClient
              ?<button onClick={()=>setShowNewClient(true)} style={{marginTop:6,background:'none',border:'none',color:G,fontSize:11,cursor:'pointer',padding:0,fontWeight:600}}>+ Agregar cliente nuevo</button>
              :<div style={{display:'flex',gap:6,marginTop:6}}>
                <input value={newClientNombre} onChange={e=>setNewClientNombre(e.target.value)} placeholder='Nombre del cliente' style={{...inp,flex:1,padding:'6px 8px'}}
                  onKeyDown={e=>e.key==='Enter'&&addNewClientInline()}/>
                <button onClick={addNewClientInline} style={{padding:'6px 12px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>OK</button>
                <button onClick={()=>setShowNewClient(false)} style={{padding:'6px 10px',background:'none',border:'1px solid #e5e7eb',borderRadius:6,cursor:'pointer',fontSize:12}}>→</button>
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
              <select value={itemProd} onChange={e=>{const pid=e.target.value;setItemProd(pid);const p=products.find(x=>x.id===pid);if(p)setItemPrecio(p.precioVenta||p.precio||p.price||0);}} style={inp}>
                <option value=''>→ Producto →</option>
                {products.filter(p=>(p.stock||0)>0).sort((a,b)=>(a.nombre||a.name||'').localeCompare(b.nombre||b.name||'')).map(p=><option key={p.id} value={p.id}>{p.nombre||p.name} → stock: {p.stock} {p.unit||''}</option>)}
              </select>
            </div>
            {/* Lot selector → only shown when selected product has available lots */}
            {itemProd && lotes.filter(l => l.productoId === itemProd && Number(l.cantidad) > 0).length > 0 && (
              <div style={{flex:2,minWidth:140}}>
                <select value={itemLote} onChange={e=>setItemLote(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',border:`1px solid ${itemLote?G:'#e5e7eb'}`,borderRadius:6,fontSize:12,fontFamily:'inherit',background:itemLote?G+'0d':'#fff',color:itemLote?G:'inherit'}}>
                  <option value=''>Lote (opcional)</option>
                  {lotes.filter(l=>l.productoId===itemProd && Number(l.cantidad)>0)
                    .sort((a,b)=>new Date(a.fechaVenc||'9999')-new Date(b.fechaVenc||'9999'))
                    .map(l=>(
                      <option key={l.id} value={l.id}>
                        {l.lote||'Sin nro'} · {Number(l.cantidad)} {l.unidad||'u'}{l.fechaVenc?' · '+new Date(l.fechaVenc+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}):''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div style={{width:90}}><input type='number' placeholder='Cant.' value={itemCant} onChange={e=>setItemCant(e.target.value)} style={inp} min='1'/></div>
            <div style={{width:110}}><input type='number' placeholder='Precio u.' value={itemPrecio} onChange={e=>setItemPrecio(e.target.value)} style={inp} min='0'/></div>
            <button onClick={agregarItem} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Agregar</button>
          </div>
        </div>

        {form.items.length>0&&(
          <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb',marginBottom:14}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9fafb'}}>{['Producto','Cant.','Precio u.','Costo u.','Margen','Subtotal',''].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}</tr></thead>
              <tbody>
                {form.items.map((it,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6'}}>
                    <td style={{padding:'9px 12px',fontWeight:500}}>{it.nombre}{it.loteNro&&<span style={{marginLeft:6,fontSize:10,fontWeight:700,color:G,background:G+'18',padding:'1px 7px',borderRadius:20}}>L:{it.loteNro}</span>}</td>
                    <td style={{padding:'9px 12px'}}>{it.cantidad} {it.unidad}</td>
                    <td style={{padding:'9px 12px',color:'#6b7280'}}>{fmtUSD(it.precioUnit)}</td><td style={{padding:'9px 12px',color:'#9ca3af',fontSize:12}}>{it.costoUnit>0?fmtUSD(it.costoUnit):'→'}</td><td style={{padding:'9px 12px',fontWeight:600,fontSize:12,color:it.costoUnit>0&&it.precioUnit>0?(((it.precioUnit-it.costoUnit)/it.precioUnit)>=0.15?'#3a7d1e':'#d97706'):'#9ca3af'}}>{it.costoUnit>0&&it.precioUnit>0?fmtPct((it.precioUnit-it.costoUnit)/it.precioUnit*100):'→'}</td>
                    <td style={{padding:'9px 12px',fontWeight:700,color:G}}>${(it.cantidad*it.precioUnit).toLocaleString('es-UY')}</td>
                    <td style={{padding:'9px 8px'}}><button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626'}}>→</button></td>
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
                  <td colSpan='5' style={{padding:'10px 12px',textAlign:'right',fontWeight:700}}>TOTAL</td>
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
          {saving?'Guardando→¦':'Crear orden de venta'}
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
          <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>→</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#1a1a1a',margin:0}}>
              {v.nroVenta} → {v.clienteNombre}
              {v.tieneDevolucion&&<span style={{marginLeft:10,fontSize:11,fontWeight:700,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',padding:'2px 8px',borderRadius:20,verticalAlign:'middle'}}>→© Con devolución</span>}
            </h2>
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
          {v.estado==='entregada'&&<button onClick={()=>{setCobroPrefill({clienteId:v.clienteId,clienteNombre:v.clienteNombre,monto:v.total,ventaId:v.id});setShowCobro(true);}} style={{padding:'7px 14px',background:'#fff',border:'1px solid #3a7d1e',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,color:'#3a7d1e'}}>📊° Cobrar</button>}
          {v.estado==='entregada'&&<button onClick={()=>{setFacturarVenta(v);setShowFacturar(true);}} style={{padding:'7px 14px',background:'#fff',border:'1px solid #6366f1',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,color:'#6366f1'}}>📊 Facturar</button>}
          {(v.estado==='preparada'||v.estado==='confirmada'||v.estado==='entregada')&&<button onClick={()=>setRemitoVenta(v)} style={{padding:'7px 14px',background:'#fff',border:'1px solid #374151',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,color:'#374151'}}>📄 Remito</button>}
        </div>
        {/* ── Estado timeline ─────────────────────────────────────── */}
        {v.estadoLog?.length > 0 && (
          <div style={{background:'#fff',borderRadius:12,padding:'14px 20px',marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:.5,marginBottom:12}}>
              Historial de estados
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {v.estadoLog.map((entry,i)=>{
                const colors={pendiente:'#9ca3af',confirmada:'#3b82f6',preparada:'#8b5cf6',en_ruta:'#f59e0b',entregada:G,cancelada:'#dc2626'};
                const labels={pendiente:'Pendiente',confirmada:'Confirmada',preparada:'Preparada',en_ruta:'En ruta',entregada:'Entregada',cancelada:'Cancelada'};
                const color=colors[entry.to]||'#9ca3af';
                const ts=entry.ts?new Date(entry.ts).toLocaleString('es-UY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
                return (
                  <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:color,marginTop:4,flexShrink:0}}/>
                      {i<v.estadoLog.length-1&&<div style={{width:2,height:24,background:'#e5e7eb',margin:'2px 0'}}/>}
                    </div>
                    <div style={{paddingBottom:i<v.estadoLog.length-1?8:0}}>
                      <span style={{fontSize:12,fontWeight:700,color}}>{labels[entry.to]||entry.to}</span>
                      {entry.user&&entry.user!=='sistema'&&<span style={{fontSize:11,color:'#9a9a98'}}> · {entry.user.split('@')[0]}</span>}
                      {ts&&<span style={{fontSize:11,color:'#9a9a98'}}> · {ts}</span>}
                      {entry.nota&&<div style={{fontSize:11,color:'#6a6a68',marginTop:2}}>📝 {entry.nota}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Írdenes de Venta</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Gestión de ventas a clientes → remitos y estado de entrega</p>
        </div>
        <button onClick={()=>{setForm(emptyForm);setVista('form');}} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nueva venta</button>
      </div>
      <MsgBanner/>
      {/* →→ Pedidos del portal B2B →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→ */}
      <PedidosPortalPanel onImportar={async (order)=>{
        // Convert portal order to venta — enrich items with costs from product catalog
        const ventaId  = crypto.randomUUID();
        const nroVenta = await fetchNextNroVenta(ventas);
        const enrichedItems = (order.items||[]).map(it => {
          const prod = products.find(p =>
            p.id === (it.productId||it.productoId) ||
            (p.nombre||p.name||'').toLowerCase() === (it.nombre||it.name||'').toLowerCase()
          );
          return { ...it,
            productoId: it.productId || it.productoId || '',
            nombre:     it.nombre    || it.name        || '',
            precioUnit: Number(it.precio || it.precioUnit || 0),
            costoUnit:  prod ? Number(prod.unitCost || 0) : 0,
            unidad:     it.unidad    || it.unit          || '',
            cantidad:   Number(it.qty || it.cantidad     || 0),
          };
        });
        const newVenta = {
          id: ventaId, nroVenta,
          clienteId:    order.cliente_id     || '',
          clienteNombre:order.cliente_nombre || '',
          items:        enrichedItems,
          total:        Number(order.total   || 0),
          descuento: 0, estado: 'pendiente',
          fecha:     new Date().toISOString().slice(0, 10),
          notas:     order.notas || '',
          origenPortal: true, orderId: order.id,
          creadoEn:  new Date().toISOString(), estadoLog: [],
        };
        setVentas(v => [newVenta, ...v]);
        await db.upsert('ventas', {
          id: newVenta.id, nro_venta: newVenta.nroVenta,
          cliente_id: newVenta.clienteId, cliente_nombre: newVenta.clienteNombre,
          items: newVenta.items, total: newVenta.total, descuento: 0,
          estado: 'pendiente', fecha: newVenta.fecha, notas: newVenta.notas,
          b2b_order_id: order.id,
        }, 'id').catch(() => {});
        const SB_URL2=import.meta.env.VITE_SUPABASE_URL;
        const SKEY2=import.meta.env.VITE_SUPABASE_ANON_KEY;
        if(SB_URL2&&order.id)fetch(`${SB_URL2}/rest/v1/b2b_orders?id=eq.${order.id}`,{
          method:'PATCH',
          headers:{apikey:SKEY2,Authorization:`Bearer ${SKEY2}`,'Content-Type':'application/json',Prefer:'return=minimal'},
          body:JSON.stringify({estado:'importada',venta_id:ventaId}),
        }).catch(()=>{});
        showMsg(`Pedido importado como ${nroVenta}`);
      }}/>
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
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
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
                  <td style={{padding:'11px 14px',fontFamily:'monospace',fontWeight:700,color:G,fontSize:12}}>
                    {v.nroVenta}
                    {v.tieneDevolucion&&<span style={{marginLeft:5,fontSize:9,fontWeight:700,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',padding:'1px 5px',borderRadius:20,verticalAlign:'middle'}}>→© DEV</span>}
                  </td>
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
    {remitoVenta&&<RemitoPDF venta={remitoVenta} brandCfg={brandCfg} onClose={()=>setRemitoVenta(null)}/>}
    {showFacturar&&facturarVenta&&<ModalFactura
      clientes={clientes}
      productos={products}
      prefill={{
        clienteId: facturarVenta.clienteId,
        items: (facturarVenta.items||[]).map(it=>({...it,
          productoId: it.productId||it.productoId||'',
          descripcion: it.nombre||it.descripcion||'',
          cantidad: it.cantidad||it.qty||1,
          precioUnit: it.precioUnit||it.precio||0,
          subtotal: it.subtotal||(it.precioUnit||it.precio||0)*(it.cantidad||it.qty||1),
        })),
        notas: facturarVenta.notas||'',
      }}
      onSave={(cfe)=>{
        // Save CFE directly → same logic as FacturacionTab.handleSaveCFE
        const CFE_TIPOS={
          'e-Factura':{code:'eFact'},'e-Ticket':{code:'eTick'},
          'e-Remito':{code:'eRem'},'e-N.Créd.':{code:'eNC'},
        };
        const code = CFE_TIPOS[cfe.tipo]?.code||'CFE';
        const seq  = cfes.length + 1;
        const numero = `${code}-${String(seq).padStart(6,'0')}`;
        const nuevo = { ...cfe, id: crypto.randomUUID(), numero,
          saldoPendiente: cfe.total, createdAt: new Date().toISOString() };
        setCfes(prev => [nuevo, ...prev]);
        db.upsert('invoices', {
          id: nuevo.id, numero, tipo: nuevo.tipo, moneda: nuevo.moneda,
          fecha: nuevo.fecha, fecha_venc: nuevo.fechaVenc||null,
          cliente_id: nuevo.clienteId||null, cliente_nombre: nuevo.clienteNombre,
          cliente_rut: nuevo.clienteRut||'', subtotal: nuevo.subtotal||0,
          iva_total: nuevo.ivaTotal||0, descuento: nuevo.descuento||0,
          total: nuevo.total, saldo_pendiente: nuevo.total,
          status: nuevo.status, items: nuevo.items, notas: nuevo.notas||'',
          created_at: nuevo.createdAt,
        }, 'id').catch(()=>setHasPendingSync(true));
        setShowFacturar(false); setFacturarVenta(null);
        showMsg(`CFE ${numero} emitida →`);
      }}
      onClose={()=>{setShowFacturar(false);setFacturarVenta(null);}}
    />}
    {showCobro&&<ModalCobro
      clientes={clientes} cfes={cfes||[]}
      prefillClienteId={cobroPrefill?.clienteId}
      prefillMonto={cobroPrefill?.monto}
      onSave={handleSaveCobroRapido}
      onClose={()=>{setShowCobro(false);setCobroPrefill(null);}}
    />}
    </section>
  );
}
export default VentasTab;

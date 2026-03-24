import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';

function ClientesTab(){
  const { clientes: items, setClientes: setItems } = useApp();
  const G="#3a7d1e";
  const { confirm, ConfirmDialog } = useConfirm();
  const TIPOS=["Panadería","Heladería","Pastelería","HORECA","Catering","Supermercado","Otro"];
  const TCOLOR={"Panadería":"#f59e0b","Heladería":"#3b82f6","Pastelería":"#ec4899","HORECA":"#8b5cf6","Catering":"#06b6d4","Supermercado":"#10b981","Otro":"#6b7280"};
  const emptyForm={nombre:'',tipo:'Panadería',condPago:'credito_30',limiteCredito:'',emailFacturacion:'',rut:'',telefono:'',email:'',direccion:'',ciudad:'',contacto:'',notas:''};
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  
  
  const [q,setQ]=useState('');
  const [filtro,setFiltro]=useState('Todos');
  const [vista,setVista]=useState('lista');
  const [selId,setSelId]=useState(null);
  const [msg,setMsg]=useState('');
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
      ? {...form, id: newId, creado: new Date().toISOString()}
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

  const edit=(x)=>{setForm({nombre:x.nombre,tipo:x.tipo,rut:x.rut||'',telefono:x.telefono||'',email:x.email||'',direccion:x.direccion||'',ciudad:x.ciudad||'',contacto:x.contacto||'',notas:x.notas||''});setEditId(x.id);setVista('form');};
  const filtered=items.filter(x=>(!q||x.nombre.toLowerCase().includes(q.toLowerCase())||(x.ciudad||'').toLowerCase().includes(q.toLowerCase()))&&(filtro==='Todos'||x.tipo===filtro));
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const backBtn=<button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>;
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>{backBtn}<h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar cliente':'Nuevo cliente'}</h2></div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'Nombre *',k:'nombre',full:true},{l:'Tipo',k:'tipo',sel:true},{l:'RUT',k:'rut'},{l:'Teléfono',k:'telefono'},{l:'Email',k:'email'},{l:'Contacto',k:'contacto'},{l:'Dirección',k:'direccion',full:true},{l:'Ciudad',k:'ciudad'},{l:'Notas',k:'notas',full:true,ta:true},{l:'Cond. pago',k:'condPago',sel2:true},{l:'Límite crédito (USD)',k:'limiteCredito'},{l:'Email facturación',k:'emailFacturacion',full:true}].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
            {f.sel?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{...inp,background:'#fff'}}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select>
            :f.sel2?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{...inp,background:'#fff'}}><option value='contado'>Contado</option><option value='credito_15'>Crédito 15 días</option><option value='credito_30'>Crédito 30 días</option><option value='credito_60'>Crédito 60 días</option><option value='credito_90'>Crédito 90 días</option></select>
            :f.ta?<textarea value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}} />
            :<input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inp} />}
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
      <div style={{display:'flex',alignItems:'center',marginBottom:24}}>{backBtn}<h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0,flex:1}}>{sel.nombre}</h2><span style={{background:TCOLOR[sel.tipo]||'#6b7280',color:'#fff',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20}}>{sel.tipo}</span></div>
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'RUT',v:sel.rut||'—'},{l:'Teléfono',v:sel.telefono||'—'},{l:'Email',v:sel.email||'—'},{l:'Contacto',v:sel.contacto||'—'},{l:'Dirección',v:sel.direccion||'—',full:true},{l:'Ciudad',v:sel.ciudad||'—'},{l:'Cond. pago',v:{contado:'Contado',credito_15:'Crédito 15d',credito_30:'Crédito 30d',credito_60:'Crédito 60d',credito_90:'Crédito 90d'}[sel.condPago]||'—'},{l:'Límite crédito',v:sel.limiteCredito?'USD '+sel.limiteCredito:'Sin límite'},{l:'Cliente desde',v:sel.creado?new Date(sel.creado).toLocaleDateString('es-UY'):'—'},{l:'Notas',v:sel.notas||'—',full:true}].map(f=>(
          <div key={f.l} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{f.l}</div>
            <div style={{fontSize:14,color:'#1a1a1a'}}>{f.v}</div>
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8,borderTop:'1px solid #f3f4f6',paddingTop:16}}>
          <button onClick={()=>del(sel.id)} style={{padding:'8px 18px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',color:'#dc2626',cursor:'pointer',fontSize:13}}>Eliminar</button>
          <button onClick={()=>edit(sel)} style={{padding:'8px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Editar</button>
        </div>
      </div>
    </section>
  );
  return(
    <>{ConfirmDialog}<section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Clientes <span style={{fontSize:16,color:'#888',fontWeight:400}}>({filtered.length})</span></h2>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nuevo cliente</button>
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
    </section></>
  );
}

export default ClientesTab;

import { useState } from 'react';
import { LS } from '../lib/constants.js';

function LotesTab(){
  const G="#3a7d1e";
  const KLOTES="aryes-lots";
  const KPROD="aryes6-products";
  const emptyForm={productoId:'',productoNombre:'',lote:'',fechaVenc:'',cantidad:0,proveedor:'',notas:''};
  const [lotes,setLotes]=useState(()=>LS.get(KLOTES,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  const [vista,setVista]=useState('lista');
  const [filtro,setFiltro]=useState('todos');
  const [q,setQ]=useState('');
  const [msg,setMsg]=useState('');

  const hoy=new Date();
  const enXDias=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d;};
  const diasParaVencer=(fechaStr)=>{
    if(!fechaStr)return 9999;
    const diff=new Date(fechaStr)-hoy;
    return Math.ceil(diff/(1000*60*60*24));
  };
  const estadoLote=(l)=>{
    const dias=diasParaVencer(l.fechaVenc);
    if(dias<0)return{label:'Vencido',color:'#ef4444',bg:'#fef2f2'};
    if(dias<=30)return{label:'Vence pronto',color:'#f59e0b',bg:'#fffbeb'};
    if(dias<=90)return{label:'Atención',color:'#f97316',bg:'#fff7ed'};
    return{label:'OK',color:'#10b981',bg:'#f0fdf4'};
  };
  const guardar=()=>{
    if(!form.productoId){setMsg('Selecciona un producto');return;}
    if(!form.fechaVenc){setMsg('La fecha de vencimiento es obligatoria');return;}
    if(!form.cantidad||form.cantidad<=0){setMsg('La cantidad debe ser mayor a 0');return;}
    const pNombre=prods.find(p=>String(p.id)===String(form.productoId))?.nombre||form.productoId;
    const item={...form,productoNombre:pNombre,cantidad:Number(form.cantidad),id:editId||Date.now(),creado:new Date().toISOString()};
    const upd=editId?lotes.map(l=>l.id===editId?item:l):[...lotes,item];
    setLotes(upd);LS.set(KLOTES,upd);
    setMsg(editId?'Lote actualizado':'Lote registrado');
    setForm(emptyForm);setEditId(null);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const eliminar=(id)=>{
    if(!confirm('Eliminar este lote?'))return;
    const upd=lotes.filter(l=>l.id!==id);
    setLotes(upd);LS.set(KLOTES,upd);
  };
  const editar=(l)=>{
    setForm({productoId:l.productoId,productoNombre:l.productoNombre,lote:l.lote||'',fechaVenc:l.fechaVenc,cantidad:l.cantidad,proveedor:l.proveedor||'',notas:l.notas||''});
    setEditId(l.id);setVista('form');
  };

  // FEFO sort: first expired first, then by vencimiento date asc
  const lotesFEFO=[...lotes].sort((a,b)=>new Date(a.fechaVenc)-new Date(b.fechaVenc));

  const filtered=lotesFEFO.filter(l=>{
    const matchQ=!q||(l.productoNombre||'').toLowerCase().includes(q.toLowerCase())||(l.lote||'').toLowerCase().includes(q.toLowerCase());
    const dias=diasParaVencer(l.fechaVenc);
    const matchF=filtro==='todos'||(filtro==='vencidos'&&dias<0)||(filtro==='pronto'&&dias>=0&&dias<=30)||(filtro==='atencion'&&dias>30&&dias<=90)||(filtro==='ok'&&dias>90);
    return matchQ&&matchF;
  });

  const vencidos=lotes.filter(l=>diasParaVencer(l.fechaVenc)<0).length;
  const proximos=lotes.filter(l=>{const d=diasParaVencer(l.fechaVenc);return d>=0&&d<=30;}).length;
  const atencion=lotes.filter(l=>{const d=diasParaVencer(l.fechaVenc);return d>30&&d<=90;}).length;
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:600,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>
        <button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar lote':'Registrar lote'}</h2>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{gridColumn:'1/-1'}}>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto *</label>
          <select value={form.productoId} onChange={e=>setForm(p=>({...p,productoId:e.target.value}))} style={{...inp,background:'#fff'}}>
            <option value=''>- Selecciona un producto -</option>
            {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {[
          {l:'N° de Lote',k:'lote',ph:'Ej: L240315'},
          {l:'Fecha Vencimiento *',k:'fechaVenc',type:'date'},
          {l:'Cantidad (unidades)',k:'cantidad',type:'number'},
          {l:'Proveedor',k:'proveedor',ph:'Ej: Selecta'},
          {l:'Notas',k:'notas',full:true,ta:true},
        ].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
            {f.ta?
              <textarea value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} />:
              <input type={f.type||'text'} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||''} min={f.type==='number'?0:undefined} style={inp} />
            }
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button onClick={()=>{setVista('lista');setEditId(null);}} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} style={{padding:'9px 24px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>{editId?'Guardar cambios':'Registrar lote'}</button>
        </div>
      </div>
    </section>
  );
  return(
    <section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Lotes / Vencimientos</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0',fontStyle:'italic'}}>Ordenados por FEFO — First Expired, First Out</p>
        </div>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Registrar lote</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Total lotes',val:lotes.length,color:'#6b7280',filtro:'todos'},
          {label:'Vencidos',val:vencidos,color:'#ef4444',filtro:'vencidos'},
          {label:'Vencen en 30 dias',val:proximos,color:'#f59e0b',filtro:'pronto'},
          {label:'Atencion (90d)',val:atencion,color:'#f97316',filtro:'atencion'},
        ].map(s=>(
          <div key={s.label} onClick={()=>setFiltro(filtro===s.filtro?'todos':s.filtro)} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',cursor:'pointer',border:'2px solid '+(filtro===s.filtro?s.color:'transparent'),transition:'border .15s'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <input placeholder='Buscar producto o lote...' value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
      </div>

      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <p style={{fontSize:15}}>{lotes.length===0?'No hay lotes registrados todavia':'Sin lotes para ese filtro'}</p>
          {lotes.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar primer lote</button>}
        </div>
      ):(
        <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['Estado','Producto','N Lote','Vencimiento','Dias','Cantidad','Proveedor',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l,i)=>{
                const est=estadoLote(l);
                const dias=diasParaVencer(l.fechaVenc);
                return(
                  <tr key={l.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{background:est.bg,color:est.color,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:20,border:'1px solid '+est.color}}>{est.label}</span>
                    </td>
                    <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a1a',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.productoNombre}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontFamily:'monospace',fontSize:12}}>{l.lote||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#1a1a1a',whiteSpace:'nowrap'}}>{l.fechaVenc||'-'}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:est.color}}>{dias<0?Math.abs(dias)+' vencido':dias===0?'Hoy':dias+' dias'}</td>
                    <td style={{padding:'10px 14px',color:'#1a1a1a'}}>{l.cantidad||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12}}>{l.proveedor||'-'}</td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>editar(l)} style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:G,fontWeight:600}}>Editar</button>
                        <button onClick={()=>eliminar(l.id)} style={{padding:'4px 10px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:'#dc2626'}}>x</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{padding:'10px 14px',fontSize:12,color:'#aaa',textAlign:'right'}}>{filtered.length} lotes (ordenados por FEFO)</div>
        </div>
      )}
    </section>
  );
}

// WhatsApp notification helper
const waLink=(telefono,mensaje)=>{
  const num=telefono?telefono.replace(/[^0-9]/g,''):'';
  const txt=encodeURIComponent(mensaje);
  return num?'https://wa.me/598'+num+'?text='+txt:'https://wa.me/?text='+txt;
};
const waMensaje=(cliente,tipo,detalle)=>{
  const tpl=localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos! - Stock';
  return tpl.replace('{cliente}',cliente||'cliente').replace('{detalle}',detalle||'');
};

export default LotesTab;

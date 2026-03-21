import { useState } from 'react';
import { LS } from '../lib/constants.js';

function MovimientosTab(){
  const G="#3a7d1e";
  const KMOV="aryes-movements";
  const KPROD="aryes6-products";
  const TIPOS=["Entrada","Salida","Ajuste","Devolucion","Transferencia"];
  const TCOLOR={"Entrada":"#10b981","Salida":"#ef4444","Ajuste":"#f59e0b","Devolucion":"#3b82f6","Transferencia":"#8b5cf6"};
  const emptyForm={tipo:"Entrada",productoId:'',cantidad:1,referencia:'',notas:'',fecha:new Date().toISOString().split('T')[0]};
  const [movs,setMovs]=useState(()=>LS.get(KMOV,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [form,setForm]=useState(emptyForm);
  const [vista,setVista]=useState('lista');
  const [filtroTipo,setFiltroTipo]=useState('Todos');
  const [filtroProd,setFiltroProd]=useState('');
  const [msg,setMsg]=useState('');
  const [pag,setPag]=useState(0);
  const POR_PAG=25;
  const prodNombre=(id)=>{const p=prods.find(x=>String(x.id)===String(id));return p?p.nombre:id;};
  const registrar=()=>{
    if(!form.productoId){setMsg('Selecciona un producto');return;}
    if(!form.cantidad||form.cantidad<=0){setMsg('Cantidad debe ser mayor a 0');return;}
    const nuevo={id:crypto.randomUUID(),tipo:form.tipo,productoId:form.productoId,productoNombre:prodNombre(form.productoId),cantidad:Number(form.cantidad),referencia:form.referencia,notas:form.notas,fecha:form.fecha,timestamp:new Date().toISOString()};
    const esEntrada=(form.tipo==='Entrada'||form.tipo==='Devolucion');
    const updProds=prods.map(p=>{
      if(String(p.id)===String(form.productoId)){
        const stock=Number(p.stock)||0;
        const delta=esEntrada?Number(form.cantidad):-Number(form.cantidad);
        return {...p,stock:Math.max(0,stock+delta)};
      }
      return p;
    });
    const updMovs=[nuevo,...movs];
    setMovs(updMovs);LS.set(KMOV,updMovs);
    setProds(updProds);LS.set(KPROD,updProds);
    setMsg('Movimiento registrado');
    setForm(emptyForm);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const filtered=movs.filter(m=>{ const mt=filtroTipo==='Todos'||m.tipo===filtroTipo; const mp=!filtroProd||m.productoNombre.toLowerCase().includes(filtroProd.toLowerCase()); return mt&&mp; });
  const paginated=filtered.slice(pag*POR_PAG,(pag+1)*POR_PAG);
  const totalPags=Math.ceil(filtered.length/POR_PAG);
  const hoy=new Date();
  const mesActual=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0');
  const movMes=movs.filter(m=>m.fecha&&m.fecha.startsWith(mesActual));
  const entradas=movMes.filter(m=>m.tipo==='Entrada').reduce((a,m)=>a+m.cantidad,0);
  const salidas=movMes.filter(m=>m.tipo==='Salida').reduce((a,m)=>a+m.cantidad,0);
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:600,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>
        <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Registrar movimiento</h2>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gap:16}}>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Tipo</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {TIPOS.map(t=>(
              <button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))} style={{padding:'7px 14px',borderRadius:20,border:'2px solid '+(form.tipo===t?TCOLOR[t]:'#e5e7eb'),background:form.tipo===t?TCOLOR[t]:'#fff',color:form.tipo===t?'#fff':'#666',fontWeight:600,fontSize:12,cursor:'pointer'}}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto</label>
          <select value={form.productoId} onChange={e=>setForm(p=>({...p,productoId:e.target.value}))} style={{...inp,background:'#fff'}}>
            <option value=''>- Selecciona un producto -</option>
            {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=>(
              <option key={p.id} value={p.id}>{p.nombre}{p.stock!=null?' (stock: '+p.stock+')':''}</option>
            ))}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cantidad</label>
            <input type='number' min='1' value={form.cantidad} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))} style={inp} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type='date' value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={inp} />
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Referencia (factura, remito...)</label>
          <input value={form.referencia} onChange={e=>setForm(p=>({...p,referencia:e.target.value}))} placeholder='Ej: Factura A-001' style={inp} />
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Notas</label>
          <textarea value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button onClick={()=>setVista('lista')} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={registrar} style={{padding:'9px 24px',background:TCOLOR[form.tipo]||G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar {form.tipo}</button>
        </div>
      </div>
    </section>
  );
  return(
    <section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Movimientos de Stock</h2>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Registrar movimiento</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {[{label:'Este mes',val:movMes.length,color:'#6b7280'},{label:'Entradas (uds)',val:entradas,color:'#10b981'},{label:'Salidas (uds)',val:salidas,color:'#ef4444'}].map(s=>(
          <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'16px 20px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input placeholder='Buscar producto...' value={filtroProd} onChange={e=>{setFiltroProd(e.target.value);setPag(0);}} style={{flex:1,minWidth:180,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
        <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setPag(0);}} style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <p style={{fontSize:15}}>{movs.length===0?'Todavia no hay movimientos registrados':'Sin movimientos para ese filtro'}</p>
          {movs.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar primer movimiento</button>}
        </div>
      ):(
        <>
          <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                  {['Fecha','Tipo','Producto','Cantidad','Referencia','Notas'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((m,i)=>(
                  <tr key={m.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px',color:'#6b7280',whiteSpace:'nowrap'}}>{m.fecha||'-'}</td>
                    <td style={{padding:'10px 14px'}}><span style={{background:TCOLOR[m.tipo]||'#6b7280',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:20}}>{m.tipo}</span></td>
                    <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a1a',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.productoNombre}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:(m.tipo==='Entrada'||m.tipo==='Devolucion')?'#10b981':'#ef4444'}}>{(m.tipo==='Entrada'||m.tipo==='Devolucion')?'+':'-'}{m.cantidad}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12}}>{m.referencia||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.notas||'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPags>1&&(
            <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:16}}>
              <button onClick={()=>setPag(p=>Math.max(0,p-1))} disabled={pag===0} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:pag===0?'#f3f4f6':'#fff',cursor:pag===0?'default':'pointer',fontSize:13}}>Anterior</button>
              <span style={{padding:'6px 14px',fontSize:13,color:'#666'}}>{pag+1} / {totalPags}</span>
              <button onClick={()=>setPag(p=>Math.min(totalPags-1,p+1))} disabled={pag===totalPags-1} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:pag===totalPags-1?'#f3f4f6':'#fff',cursor:pag===totalPags-1?'default':'pointer',fontSize:13}}>Siguiente</button>
            </div>
          )}
          <div style={{textAlign:'right',marginTop:8,fontSize:12,color:'#aaa'}}>{filtered.length} movimientos totales</div>
        </>
      )}
    </section>
  );
}

export default MovimientosTab;

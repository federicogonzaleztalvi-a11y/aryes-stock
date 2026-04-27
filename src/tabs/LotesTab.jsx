import { useState, useMemo } from 'react';
import { useRole } from '../hooks/useRole.ts';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';

function LotesTab(){
  const { products: prods, lotes, setLotes, ventas } = useApp();
  const { isAdmin } = useRole();
  const G="#059669";
  const { confirm, ConfirmDialog } = useConfirm();
  const emptyForm={productoId:'',productoNombre:'',lote:'',fechaVenc:'',cantidad:0,proveedor:'',notas:''};
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  const [vista,setVista]=useState('lista');
  const [filtro,setFiltro]=useState('todos');
  const [q,setQ]=useState('');
  const [msg,setMsg]=useState('');

  const hoy=new Date();
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
    const pNombre=prods.find(p=>p.id===form.productoId)?.nombre||form.productoId;
    const item={...form,productoNombre:pNombre,cantidad:Number(form.cantidad),id:editId||crypto.randomUUID(),creado:new Date().toISOString()};
    const upd=editId?lotes.map(l=>l.id===editId?item:l):[...lotes,item];
    setLotes(upd);
    // Persist to Supabase lotes table
    db.upsert('lotes',{
      id:item.id, producto_id:item.productoId, producto_nombre:item.productoNombre,
      lote:item.lote||'', fecha_venc:item.fechaVenc||null, cantidad:Number(item.cantidad)||0,
      proveedor:item.proveedor||'', notas:item.notas||'',
      creado_en:item.creado, updated_at:new Date().toISOString(),
    },'id').catch(e=>{
      console.warn('[LotesTab] upsert failed:',e?.message||e);
      setMsg('⚠ Guardado localmente — no se sincronizó con el servidor');
      setTimeout(()=>setMsg(''),5000);
    });
    setMsg(editId?'Lote actualizado':'Lote registrado');
    setForm(emptyForm);setEditId(null);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const eliminar=async(id)=>{
    const ok = await confirm({ title:'¿Eliminar este lote?', variant:'danger' });
    if(!ok) return;
    const upd=lotes.filter(l=>l.id!==id);
    setLotes(upd);
    db.del('lotes',{id}).catch(e=>console.warn('[LotesTab] delete failed:',e?.message||e));
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

  // ── Traceability hooks — must be before any early returns ─────────────────
  const [trazaQuery, setTrazaQuery] = useState('');
  const [trazaOpen,  setTrazaOpen]  = useState(false);

  const trazaResults = useMemo(() => {
    if (!trazaQuery.trim()) return [];
    const q = trazaQuery.trim().toLowerCase();
    const matchingLoteIds = new Set(
      lotes.filter(l =>
        (l.lote||'').toLowerCase().includes(q) ||
        (l.productoNombre||'').toLowerCase().includes(q)
      ).map(l => l.id)
    );
    if (matchingLoteIds.size === 0) return [];
    const results = [];
    ventas.filter(v => v.estado !== 'cancelada').forEach(v => {
      (v.items||[]).forEach(it => {
        if (it.loteId && matchingLoteIds.has(it.loteId)) {
          results.push({
            nroVenta: v.nroVenta, clienteNombre: v.clienteNombre,
            fecha: v.creadoEn ? new Date(v.creadoEn).toLocaleDateString('es') : '—',
            cantidad: it.cantidad, unidad: it.unidad,
            loteNro: it.loteNro || '—', productoNombre: it.nombre,
          });
        }
      });
    });
    return results.sort((a,b) => (b.nroVenta||'').localeCompare(a.nroVenta||''));
  }, [trazaQuery, lotes, ventas]);

  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:600,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>
        <button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar lote':'Registrar lote'}</h2>
      </div>
      {msg&&<div style={{background:'#f0fdf4',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{gridColumn:'1/-1'}}>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto *</label>
          <select value={form.productoId} onChange={e=>setForm(p=>({...p,productoId:e.target.value}))} style={{...inp,background:'#fff'}}>
            <option value=''>- Selecciona un producto -</option>
            {prods.filter(p=>p&&p.nombre).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
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
    <>{ConfirmDialog}<section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Lotes / Vencimientos</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0',fontStyle:'italic'}}>Ordenados por FEFO — First Expired, First Out</p>
        </div>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Registrar lote</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

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
          <p style={{fontSize:15}}>{lotes.length===0?'No hay lotes registrados todavía. Los lotes se crean al recibir mercadería.':'Sin lotes para ese filtro'}</p>
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
                        {isAdmin&&<button onClick={()=>editar(l)} style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:G,fontWeight:600}}>Editar</button>}
                        {isAdmin&&<button onClick={()=>eliminar(l.id)} style={{padding:'4px 10px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:'#dc2626'}}>x</button>}
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
      {/* ── Trazabilidad de lote ──────────────────────────────────────────── */}
      <div style={{marginTop:28,background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <button onClick={()=>setTrazaOpen(o=>!o)}
          style={{width:'100%',display:'flex',alignItems:'center',gap:10,background:'none',border:'none',
                  cursor:'pointer',padding:0,textAlign:'left'}}>
          <span style={{fontSize:16}}>🔍</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:500,color:'#1a1a1a',flex:1}}>
            Trazabilidad de lote — ¿Qué clientes recibieron un lote?
          </span>
          <span style={{fontSize:11,color:'#9ca3af'}}>{trazaOpen?'▲':'▼'}</span>
        </button>
        {trazaOpen&&(
          <div style={{marginTop:16}}>
            <div style={{display:'flex',gap:10,marginBottom:16}}>
              <input value={trazaQuery} onChange={e=>setTrazaQuery(e.target.value)}
                placeholder="Buscar por nro de lote o nombre de producto... (ej: L-024)"
                style={{flex:1,padding:'9px 14px',border:'1px solid #e5e7eb',borderRadius:8,
                        fontSize:13,fontFamily:'inherit'}}/>
              {trazaQuery&&<button onClick={()=>setTrazaQuery('')}
                style={{padding:'9px 14px',border:'1px solid #e5e7eb',borderRadius:8,
                        background:'#fff',cursor:'pointer',fontSize:13,color:'#666'}}>
                Limpiar
              </button>}
            </div>
            {trazaQuery.trim()&&(
              trazaResults.length===0?(
                <div style={{textAlign:'center',padding:'24px',color:'#888',fontSize:13,
                             background:'#f9fafb',borderRadius:8}}>
                  No se encontraron ventas con ese lote.
                  {' '}{lotes.some(l=>(l.lote||'').toLowerCase().includes(trazaQuery.toLowerCase()))
                    ? 'El lote existe pero no fue vinculado a ninguna venta aún.'
                    : 'Lote no encontrado en el sistema.'}
                </div>
              ):(
                <>
                  <div style={{marginBottom:10,fontSize:12,fontWeight:700,color:G}}>
                    {trazaResults.length} entrega{trazaResults.length!==1?'s':''} encontrada{trazaResults.length!==1?'s':''}
                  </div>
                  <div style={{background:'#fff',borderRadius:10,overflow:'hidden',border:'1px solid #e5e7eb'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                          {['Venta','Cliente','Fecha','Producto','Lote','Cantidad'].map(h=>(
                            <th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:600,
                                              color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trazaResults.map((r,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:12,color:G,fontWeight:700}}>{r.nroVenta}</td>
                            <td style={{padding:'9px 14px',fontWeight:600}}>{r.clienteNombre}</td>
                            <td style={{padding:'9px 14px',color:'#6b7280',whiteSpace:'nowrap'}}>{r.fecha}</td>
                            <td style={{padding:'9px 14px'}}>{r.productoNombre}</td>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:12}}>
                              <span style={{background:G+'18',color:G,padding:'2px 8px',borderRadius:20,fontWeight:700,fontSize:11}}>
                                {r.loteNro}
                              </span>
                            </td>
                            <td style={{padding:'9px 14px',fontWeight:700}}>{r.cantidad} {r.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:'#9ca3af',fontStyle:'italic'}}>
                    Solo ventas donde el lote fue seleccionado explícitamente al crear la venta.
                  </div>
                </>
              )
            )}
            {!trazaQuery.trim()&&(
              <div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:'16px 0'}}>
                Ingresá un número de lote o producto para ver qué clientes lo recibieron.
              </div>
            )}
          </div>
        )}
      </div>

    </section></>
  );
}


export default LotesTab;

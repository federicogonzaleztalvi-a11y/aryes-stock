// src/components/ReorderPointWidget.jsx
import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
const G='#1a8a3c';
const fmt1=n=>Number(n||0).toLocaleString('es-UY',{minimumFractionDigits:1,maximumFractionDigits:1});
export default function ReorderPointWidget(){
  const{products,calcReorderPoints}=useApp();
  const[loading,setLoading]=useState(false);
  const[results,setResults]=useState(null);
  const[open,setOpen]=useState(true);
  const[lastRun,setLastRun]=useState(null);
  const run=async()=>{
    setLoading(true);
    try{const rows=await calcReorderPoints();setResults({all:rows||[],changed:(rows||[]).filter(r=>r.changed)});setLastRun(new Date());}
    catch(e){console.error(e);}
    setLoading(false);
  };
  const urgentes=(results?.all||[]).map(r=>{
    const prod=products.find(p=>p.id===r.product_uuid);
    const upd=Number(r.units_per_day_val)||0;
    const dias=upd>0?Math.floor((prod?.stock||0)/upd):999;
    return{...r,prod,diasStock:dias};
  }).filter(r=>r.diasStock<(r.lead_time_days||7)*1.3).sort((a,b)=>a.diasStock-b.diasStock).slice(0,6);
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',marginBottom:20,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:urgentes.length>0?'#fff7ed':'#f9fafb',borderBottom:open?'1px solid #f3f4f6':'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>📐</span>
          <div>
            <span style={{fontSize:14,fontWeight:700,color:'#1a1a1a'}}>Punto de reorden dinámico</span>
            {urgentes.length>0&&<span style={{marginLeft:8,background:'#f97316',color:'#fff',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{urgentes.length} urgente{urgentes.length!==1?'s':''}</span>}
            {lastRun&&<span style={{marginLeft:8,fontSize:11,color:'#9ca3af'}}>· {lastRun.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})}</span>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={e=>{e.stopPropagation();run();}} disabled={loading} style={{background:loading?'#9ca3af':G,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:loading?'not-allowed':'pointer'}}>{loading?'Calculando...':'⟳ Recalcular'}</button>
          <span style={{color:'#9ca3af',fontSize:12}}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open&&<div style={{padding:'16px 20px'}}>
        {results===null&&(
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:13,color:'#6b7280',marginBottom:12,lineHeight:1.6}}>Calcula el stock mínimo óptimo:<br/><strong>consumo_diario × lead_time × 1.2</strong></div>
            <button onClick={run} disabled={loading} style={{background:G,color:'#fff',border:'none',borderRadius:10,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{loading?'Calculando...':'📐 Calcular puntos de reorden'}</button>
          </div>
        )}
        {results!==null&&(
          <>
            <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
              {[{l:'Analizados',v:results.all.length,c:'#374151'},{l:'Actualizados',v:results.changed.length,c:results.changed.length>0?'#d97706':G},{l:'Urgentes',v:urgentes.length,c:urgentes.length>0?'#f97316':G}].map(k=>(
                <div key={k.l} style={{background:'#f9fafb',borderRadius:10,padding:'10px 16px',flex:1,minWidth:100,textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:800,color:k.c}}>{k.v}</div>
                  <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{k.l}</div>
                </div>
              ))}
            </div>
            {urgentes.length>0?(
              <div style={{display:'grid',gap:8,marginBottom:12}}>
                {urgentes.map(r=>{
                  const lt=r.lead_time_days||7;
                  const emoji=r.diasStock<lt?'🔴':'🟡';
                  return(
                    <div key={r.product_uuid} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff7ed',borderRadius:10,border:'1px solid #fed7aa',flexWrap:'wrap'}}>
                      <span style={{fontSize:16}}>{emoji}</span>
                      <div style={{flex:1,minWidth:120}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a'}}>{r.product_name}</div>
                        <div style={{fontSize:11,color:'#9ca3af'}}>Stock: {r.prod?.stock||0} · {fmt1(r.units_per_day_val)} u/día</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:14,fontWeight:800,color:r.diasStock<lt?'#dc2626':'#d97706'}}>{r.diasStock}d de stock</div>
                        <div style={{fontSize:11,color:'#9ca3af'}}>Lead: {lt}d · Mín: {r.new_min_stock}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ):<div style={{textAlign:'center',padding:'12px 0',color:G,fontSize:13,fontWeight:600}}>✅ Todos los productos cubren sus lead times</div>}
            {results.changed.length>0&&(
              <details><summary style={{cursor:'pointer',fontSize:12,color:'#6b7280',fontWeight:600,padding:'6px 0',userSelect:'none'}}>Ver {results.changed.length} mínimos actualizados ▾</summary>
                <div style={{marginTop:8,maxHeight:180,overflowY:'auto',border:'1px solid #f3f4f6',borderRadius:8}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'#f9fafb'}}>
                      {['Producto','u/día','Lead','Antes','Ahora'].map(h=><th key={h} style={{padding:'6px 10px',fontWeight:700,color:'#374151',fontSize:11,textTransform:'uppercase',textAlign:h==='Producto'?'left':'right'}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{results.changed.slice(0,30).map((r,i)=>(
                      <tr key={r.product_uuid} style={{borderTop:i>0?'1px solid #f3f4f6':'none'}}>
                        <td style={{padding:'6px 10px',color:'#1a1a1a'}}>{r.product_name}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#6b7280'}}>{fmt1(r.units_per_day_val)}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#6b7280'}}>{r.lead_time_days}d</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#9ca3af',textDecoration:'line-through'}}>{r.old_min_stock}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',fontWeight:700,color:G}}>{r.new_min_stock}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </div>}
    </div>
  );
}

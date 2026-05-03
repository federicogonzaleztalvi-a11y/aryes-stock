import { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { db } from '../../lib/constants.js';

// ── Lotes Tab ────────────────────────────────────────────────────────────
 
const LotsTab=({products,session})=>{
  const { lotes: lots, setLotes: setLots, products, session} = useApp();
  const [filter,setFilter]=useState('all');
  const [editing,setEditing]=useState(null);
  const [selProd,setSelProd]=useState('');
  const [form,setForm]=useState({lotNumber:'',quantity:'',expiryDate:'',notes:''});
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';
  const today=new Date(); today.setHours(0,0,0,0);
  const daysTo=d=>Math.floor((new Date(d)-today)/86400000);
  const st=l=>!l.fechaVenc?'ok':daysTo(l.fechaVenc)<0?'expired':daysTo(l.fechaVenc)<=30?'expiring':'ok';
  const stColor=s=>s==='expired'?'#dc2626':s==='expiring'?'#d97706':'#16a34a';
  const stBg=s=>s==='expired'?'#fef2f2':s==='expiring'?'#fffbeb':'#f0fdf4';
  const stLabel=s=>s==='expired'?'VENCIDO':s==='expiring'?'POR VENCER':'OK';
  const expired=lots.filter(l=>st(l)==='expired').length;
  const expiring=lots.filter(l=>st(l)==='expiring').length;
  const filtered=lots.filter(l=>filter==='all'?true:filter==='expiring'?st(l)!=='ok':st(l)==='expired');

  const save=()=>{
    if(!selProd||!form.lotNumber||!form.quantity){setMsg('Completá producto, lote y cantidad');return;}
    const prod=products.find(p=>p.id===selProd);
    // Normalize to canonical Lote shape (same as LotesTab)
    const lotId = editing&&editing!=='new' ? editing : 'lot-'+Date.now();
    const lot={
      id:lotId, productoId:String(selProd), productoNombre:prod?.name||prod?.nombre||'',
      lote:form.lotNumber, cantidad:Number(form.quantity),
      fechaVenc:form.expiryDate||null, proveedor:'', notas:form.notes||'',
      creadoEn:new Date().toISOString(),
    };
    const updated=editing&&editing!=='new'?lots.map(l=>l.id===editing?lot:l):[...lots,lot];
    setLots(updated);
    // Persist to Supabase lotes table
    db.upsert('lotes',{
      id:lot.id, producto_id:lot.productoId, producto_nombre:lot.productoNombre,
      lote:lot.lote||'', fecha_venc:lot.fechaVenc||null, cantidad:lot.cantidad,
      proveedor:'', notas:lot.notas||'', creado_en:lot.creadoEn,
      updated_at:new Date().toISOString(),
    },'id').catch(e=>console.warn('[importer/LotsTab] upsert failed:',e?.message||e));
    setEditing(null);setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');
    setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:860}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Control de calidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Lotes y Vencimientos</h1>
        </div>
        {canEdit&&<button onClick={()=>{setEditing('new');setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');}} style={{padding:'9px 18px',background:'#059669',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Registrar lote</button>}
      </div>
      {(expired>0||expiring>0)&&<div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {expired>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>🚨</span><div><div style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{expired} lote{expired>1?'s':''} vencido{expired>1?'s':''}</div><div style={{fontSize:11,color:'#9a9a98'}}>Revisar y dar de baja</div></div></div>}
        {expiring>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>⚠</span><div><div style={{fontSize:13,fontWeight:700,color:'#d97706'}}>{expiring} lote{expiring>1?'s':''} por vencer</div><div style={{fontSize:11,color:'#9a9a98'}}>Priorizar salida (FEFO)</div></div></div>}
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['all','Todos',lots.length],['expiring','Por vencer',expired+expiring],['expired','Vencidos',expired]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:'7px 14px',background:filter===v?'#1a1a18':'#f0f0ec',color:filter===v?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{l}{c>0&&' ('+c+')'}</button>
        ))}
      </div>
      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#059669':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo lote':'Editar lote'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar...</option>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name}</option>)}
              </select>
            </div>
            {[['Nº de lote','lotNumber','text','Ej: LOT-2024-001'],['Cantidad','quantity','number','0'],['Fecha vencimiento','expiryDate','date',''],['Notas','notes','text','Opcional']].map(([label,key,type,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>{label}</label>
                <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#059669',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}
      {filtered.length===0?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📦</div><div>{lots.length===0?'No hay lotes registrados':'Sin resultados en este filtro'}</div></div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.sort((a,b)=>(!a.fechaVenc?1:!b.fechaVenc?-1:new Date(a.fechaVenc)-new Date(b.fechaVenc))).map(l=>{
            const s=st(l),d=l.fechaVenc?daysTo(l.fechaVenc):null;
            return <div key={l.id} style={{background:'#fff',border:'1px solid '+stColor(s)+'40',borderLeft:'4px solid '+stColor(s),borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{l.productoNombre}</span>
                  <span style={{fontSize:11,background:stBg(s),color:stColor(s),padding:'2px 8px',borderRadius:10,fontWeight:600}}>{stLabel(s)}</span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'#6a6a68',flexWrap:'wrap'}}>
                  <span>Lote: <strong>{l.lote}</strong></span>
                  <span>Cant: <strong>{l.cantidad}</strong></span>
                  {l.fechaVenc&&<span style={{color:stColor(s)}}>Vence: <strong>{l.fechaVenc} ({d<0?Math.abs(d)+' días vencido':d+' días'})</strong></span>}
                  {l.notas&&<span>{l.notas}</span>}
                </div>
              </div>
              {canEdit&&<div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setSelProd(l.productoId);setForm({lotNumber:l.lote,quantity:String(l.cantidad),expiryDate:l.fechaVenc||'',notes:l.notas||''});setEditing(l.id);}} style={{padding:'5px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
                <button onClick={async()=>{ const ok=await confirm({title:'¿Eliminar este lote?',variant:'danger'}); if(!ok)return; const u=lots.filter(x=>x.id!==l.id);setLots(u);db.del('lotes',{id:l.id}).catch(e=>console.warn('[importer/LotsTab] delete failed:',e?.message||e));}} style={{padding:'5px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
              </div>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

// ── Excel Importer Tab ───────────────────────────────────────────────────
 

export { LotsTab };

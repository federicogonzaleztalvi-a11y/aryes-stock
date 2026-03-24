import { useState } from 'react';
import { LS, db } from '../../lib/constants.js';

const ExcelImportTab=({products,setProducts,session:_session})=>{
  const [step,setStep]=useState('upload'); // upload | preview | done
  const [rows,setRows]=useState([]);
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);

  const parseCSV=(text)=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
    return lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/['"]/g,''));
      const obj={};
      headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return obj;
    }).filter(r=>r.nombre||r.name||r.producto);
  };

  const mapRow=(r)=>({
    name: r.nombre||r.name||r.producto||'',
    brand: r.marca||r.brand||'',
    category: r.categoria||r.category||'',
    supplierId: (r.proveedor||r.supplier||'arg').toLowerCase().includes('ecu')?'ecu':(r.proveedor||r.supplier||'').toLowerCase().includes('eur')?'eur':'arg',
    unit: r.unidad||r.unit||'kg',
    stock: Number(r.stock||r.cantidad||0)||0,
    unitCost: Number((r.costo||r.precio_costo||r.price||r['precio costo']||'0').replace(/[^\d.]/g,''))||0,
    barcode: r.barcode||r.codigo||r['código']||'',
    minStock: Number(r.min_stock||r.stock_minimo||5)||5,
    dailyUsage: Number(r.uso_diario||r.daily_usage||0.5)||0.5,
  });

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);
    const text=await file.text();
    const parsed=parseCSV(text).map(mapRow).filter(r=>r.name);
    setRows(parsed);
    setStep(parsed.length>0?'preview':'upload');
    if(parsed.length===0) setMsg('No se encontraron productos. Verificá que el archivo sea CSV con columnas: nombre, marca, categoria, stock, costo');
    setLoading(false);
  };

  const applyImport=()=>{
    const maxId=products.reduce((m,p)=>Math.max(m,p.id),0);
    const newProds=rows.map((r,i)=>({...r,id:maxId+i+1,history:[]}));
    const updated=[...products,...newProds];
    LS.set('aryes6-products',updated);
    setProducts(updated);
    // Sync to Supabase
    const dbRows=newProds.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplier_id:p.supplierId,unit:p.unit,stock:p.stock,unit_cost:p.unitCost,min_stock:p.minStock,daily_usage:p.dailyUsage,category:p.category,brand:p.brand,history:[]}));
    db.upsert('products',dbRows).catch(e=>console.warn('sync:',e));
    setStep('done');
    setMsg(newProds.length+' productos importados correctamente ✓');
  };

  const downloadTemplate=()=>{
    const csv='nombre,marca,categoria,proveedor,unidad,stock,costo,barcode\nChocolate Cobertura Leche 1kg,Selecta,Chocolates,arg,kg,0,336.07,\nPasta Pistacho 1.5kg,MEC3,Gelato,eur,kg,0,1250,';
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='template_productos.csv';a.click();
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Carga masiva</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Importar Excel / CSV</h1>
      </div>

      {step==='upload'&&(
        <div>
          <div style={{background:'#fff',border:'2px dashed #e2e2de',borderRadius:12,padding:40,textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:12}}>📂</div>
            <div style={{fontSize:15,fontWeight:600,color:'#3a3a38',marginBottom:8}}>Subí tu archivo CSV</div>
            <div style={{fontSize:13,color:'#9a9a98',marginBottom:20}}>Exportá desde Excel como CSV y subilo acá</div>
            <label style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',display:'inline-block'}}>
              Elegir archivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:'none'}}/>
            </label>
            {loading&&<div style={{marginTop:16,color:'#9a9a98',fontSize:13}}>Procesando...</div>}
          </div>
          <div style={{background:'#f0f7ec',borderRadius:10,padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>Columnas aceptadas en el CSV:</div>
            <div style={{fontSize:12,color:'#5a7a4a',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
              <span><strong>nombre</strong> — nombre del producto</span>
              <span><strong>marca</strong> — ej: Selecta, MEC3</span>
              <span><strong>categoria</strong> — ej: Chocolates</span>
              <span><strong>proveedor</strong> — arg / ecu / eur</span>
              <span><strong>unidad</strong> — kg / lt / u</span>
              <span><strong>stock</strong> — cantidad actual</span>
              <span><strong>costo</strong> — precio de costo</span>
              <span><strong>barcode</strong> — código de barras</span>
            </div>
          </div>
          <button onClick={downloadTemplate} style={{padding:'8px 16px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>⬇ Descargar template de ejemplo</button>
          {msg&&<div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',color:'#dc2626',borderRadius:8,fontSize:13}}>{msg}</div>}
        </div>
      )}

      {step==='preview'&&(
        <div>
          <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,color:'#3a7d1e',fontWeight:600}}>✓ {rows.length} productos detectados</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('upload')} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
              <button onClick={applyImport} style={{padding:'7px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Importar {rows.length} productos</button>
            </div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9f9f7'}}>
                {['Nombre','Marca','Categoría','Proveedor','Unidad','Stock','Costo'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6a6a68',fontSize:11,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0,20).map((r,i)=><tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 14px',color:'#1a1a18',fontWeight:500}}>{r.name}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.brand||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.category||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.supplierId}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unit}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.stock}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unitCost}</td>
                </tr>)}
                {rows.length>20&&<tr><td colSpan={7} style={{padding:'9px 14px',color:'#9a9a98',fontSize:12,textAlign:'center'}}>... y {rows.length-20} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step==='done'&&(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:56,marginBottom:16}}>✅</div>
          <div style={{fontSize:22,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>{msg}</div>
          <div style={{fontSize:14,color:'#9a9a98',marginBottom:32}}>Los productos ya están disponibles en el inventario</div>
          <button onClick={()=>{setStep('upload');setRows([]);setMsg('');}} style={{padding:'10px 24px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Importar otro archivo</button>
        </div>
      )}
    </div>
  );
};


// ── Generar PDF de Orden de Compra ───────────────────────────────────────

export { ExcelImportTab };

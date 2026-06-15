import { useState } from 'react';
import * as XLSX from 'xlsx';
import { LS, db, getOrgId } from '../lib/constants.js';

function ImportTab(){
  const G="#059669";
  const KPROD="aryes6-products";
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [preview,setPreview]=useState([]);
  const [msg,setMsg]=useState('');
  const [importing,setImporting]=useState(false);

  const rowToProd=(obj)=>({
    // crypto.randomUUID() ya es único. Antes se concatenaba el índice
    // (randomUUID()+i) lo que producía un UUID inválido y Postgres rechazaba
    // el upsert → los productos se perdían en Supabase (solo quedaban en LS).
    id:crypto.randomUUID(),
    nombre:obj.nombre||obj.name||obj.producto||obj.descripcion||'',
    codigo:obj.codigo||obj.sku||obj.code||obj.cdigo||'',
    categoria:obj.categoria||obj.category||obj.rubro||obj.categora||'',
    stock:Number(obj.stock||obj.cantidad||obj.qty||0),
    unidad:obj.unidad||obj.unit||obj.um||'u',
    precio:Number(obj.precio||obj.price||obj.costo||0),
    rop:Number(obj.rop||obj.stockmin||obj.minimo||5),
    proveedor:obj.proveedor||obj.supplier||obj.marca||'',
  });

  const norm=(s)=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');

  const parseCSV=(text)=>{
    const lines=text.split('\n').filter(l=>l.trim());
    if(lines.length<2)return[];
    const headers=lines[0].split(/[,;\t]/).map(h=>norm(h));
    return lines.slice(1).map((line)=>{
      const vals=line.split(/[,;\t]/);
      const obj={};
      headers.forEach((h,j)=>obj[h]=(vals[j]||'').trim().replace(/^"|"$/g,''));
      return rowToProd(obj);
    }).filter(p=>p.nombre);
  };

  const parseXLSX=(arrayBuffer)=>{
    const wb=XLSX.read(arrayBuffer,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    return rows.map((raw)=>{
      const obj={};
      Object.keys(raw).forEach(k=>{obj[norm(k)]=raw[k];});
      return rowToProd(obj);
    }).filter(p=>p.nombre);
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    const reader=new FileReader();
    reader.onload=(ev)=>{
      let parsed=[];
      try{
        if(ext==='xlsx'||ext==='xls'){
          parsed=parseXLSX(ev.target.result);
        }else{
          parsed=parseCSV(ev.target.result);
        }
      }catch(err){
        console.error('[ImportTab] parse error:',err);
        setMsg('No se pudo leer el archivo. Verifica que sea la plantilla de Pazque.');
        return;
      }
      setPreview(parsed);
      setMsg(parsed.length+' productos detectados. Revisalos antes de importar.');
    };
    if(ext==='xlsx'||ext==='xls') reader.readAsArrayBuffer(file);
    else reader.readAsText(file,'UTF-8');
    e.target.value='';
  };

  const confirmarImport=async()=>{
    if(preview.length===0)return;
    setImporting(true);
    const existing=[...prods];
    let added=0,updated=0;
    preview.forEach(p=>{
      const idx=p.codigo
        ? existing.findIndex(e=>(e.codigo||'').toLowerCase()===p.codigo.toLowerCase())
        : existing.findIndex(e=>e.nombre?.toLowerCase()===p.nombre?.toLowerCase());
      if(idx>-1){
        // Producto ya existe: conservar su uuid para que el upsert ACTUALICE la
        // fila existente en vez de insertar un duplicado con un uuid nuevo.
        p.id=existing[idx].id;
        existing[idx]={...existing[idx],...p,id:existing[idx].id};
        updated++;
      }
      else{existing.push(p);added++;}
    });

    // Persistir a Supabase ANTES de declarar éxito. db.upsert devuelve null si
    // falla; contamos los fallos para no mostrar "importado" cuando en realidad
    // los datos no llegaron al servidor.
    let failed=0;
    for (const p of preview) {
      try {
        const res=await db.upsert('products', {
          uuid: p.id,
          name: p.nombre || p.name || '',
          codigo: p.codigo || '',
          category: p.categoria || '',
          stock: Number(p.stock) || 0,
          unit: p.unidad || p.unit || 'u',
          precio_venta: Number(p.precio) || 0,
          min_stock: Number(p.rop) || 5,
          brand: p.proveedor || '',
          org_id: getOrgId(),
          updated_at: new Date().toISOString(),
        }, 'uuid');
        if(res===null) failed++;
      } catch (e) { console.warn('[ImportTab] Supabase sync error:', e); failed++; }
    }

    setProds(existing);
    LS.set(KPROD,existing);
    setPreview([]);
    if(failed>0){
      setMsg('⚠ '+(preview.length-failed)+' productos sincronizados; '+failed+' no se guardaron en el servidor (guardados localmente, reintentá al reconectar).');
    }else{
      setMsg(added+' productos agregados, '+updated+' actualizados.');
    }
    setImporting(false);
  };

  const descargarPlantilla=()=>{
    const a=document.createElement('a');
    a.href='/Pazque_plantilla_productos.xlsx';
    a.download='Pazque_plantilla_productos.xlsx';
    a.click();
  };

  const exportCSV=()=>{
    const headers='nombre,codigo,categoria,precio,stock,unidad';
    const rows=prods.map(p=>[p.nombre||p.name||'',p.codigo||'',p.categoria||'',p.precio||p.price||0,p.stock||0,p.unidad||p.unit||'u'].join(',')).join('\n');
    const blob=new Blob([headers+'\n'+rows],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='productos.csv';a.click();
    URL.revokeObjectURL(url);
  };

  return(
    <section style={{padding:'28px 36px',maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Importar / Exportar</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Carga tus productos desde la plantilla de Pazque</p>
        </div>
        <button onClick={exportCSV} style={{padding:'8px 18px',border:'2px solid '+G,background:'#fff',color:G,borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
          &#8659; Exportar productos CSV
        </button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:'#92400e',marginBottom:8}}>Como cargar tus productos:</div>
        <div style={{fontSize:13,color:'#78350f',lineHeight:1.7}}>
          1. Descarga la plantilla con el boton de abajo<br/>
          2. Abrila en Excel o Google Sheets y carga tus productos (una fila por producto)<br/>
          3. Guarda el archivo<br/>
          4. Subilo abajo &mdash; se lee directo, sin necesidad de convertir nada
        </div>
        <div style={{marginTop:12}}>
          <button onClick={descargarPlantilla} style={{padding:'9px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
            &#8659; Descargar plantilla (.xlsx)
          </button>
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:8}}>&#128196;</div>
        <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:16}}>Subir plantilla completada</div>
        <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile}
          style={{display:'block',margin:'0 auto',padding:'10px',border:'2px dashed #e5e7eb',borderRadius:8,cursor:'pointer',width:'100%',maxWidth:400,fontSize:13}} />
        <div style={{fontSize:11,color:'#aaa',marginTop:8}}>Formatos: .xlsx &middot; .xls &middot; .csv</div>
      </div>

      {preview.length>0&&(
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#f9fafb',borderBottom:'2px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,color:'#374151'}}>Vista previa &mdash; {preview.length} productos</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPreview([])} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={confirmarImport} disabled={importing} style={{padding:'6px 18px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}>
                {importing?'Importando...':'Confirmar importacion'}
              </button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {['Nombre','Codigo','Categoria','Precio','Stock','Unidad'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0,20).map((p,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'7px 12px',fontWeight:500,color:'#1a1a1a'}}>{p.nombre}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.codigo||'-'}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.categoria||'-'}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.precio>0?'$'+p.precio:'-'}</td>
                    <td style={{padding:'7px 12px',fontWeight:700,color:G}}>{p.stock}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.unidad}</td>
                  </tr>
                ))}
                {preview.length>20&&<tr><td colSpan='6' style={{padding:'8px 12px',color:'#888',fontStyle:'italic',textAlign:'center'}}>...y {preview.length-20} mas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:10,padding:'16px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,color:'#6b7280'}}>Productos actualmente en el sistema:</span>
        <span style={{fontSize:22,fontWeight:800,color:G}}>{prods.length}</span>
      </div>
    </section>
  );
}

export default ImportTab;

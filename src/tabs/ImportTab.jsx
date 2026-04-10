import { useState } from 'react';
import { LS } from '../lib/constants.js';

function ImportTab(){
  const G="#059669";
  const KPROD="aryes6-products";
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [preview,setPreview]=useState([]);
  const [msg,setMsg]=useState('');
  const [importing,setImporting]=useState(false);
  
  const parseCSV=(text)=>{
    const lines=text.split('\n').filter(l=>l.trim());
    if(lines.length<2)return[];
    const headers=lines[0].split(/[,;\t]/).map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
    return lines.slice(1).map((line,i)=>{
      const vals=line.split(/[,;\t]/);
      const obj={};
      headers.forEach((h,j)=>obj[h]=(vals[j]||'').trim().replace(/^"|"$/g,''));
      return{
        id:crypto.randomUUID()+i,
        nombre:obj.nombre||obj.name||obj.producto||obj.descripcion||'Producto '+(i+1),
        stock:Number(obj.stock||obj.cantidad||obj.qty||0),
        unidad:obj.unidad||obj.unit||obj.um||'u',
        precio:Number(obj.precio||obj.price||obj.costo||0),
        rop:Number(obj.rop||obj.stockmin||obj.minimo||5),
        proveedor:obj.proveedor||obj.supplier||obj.marca||'',
      };
    }).filter(p=>p.nombre&&p.nombre!=='Producto 1'||p.stock>0);
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const text=ev.target.result;
      const parsed=parseCSV(text);
      setPreview(parsed);
      setMsg(parsed.length+' productos detectados. Revisalos antes de importar.');
    };
    reader.readAsText(file,'UTF-8');
  };

  const confirmarImport=()=>{
    if(preview.length===0)return;
    setImporting(true);
    const existing=[...prods];
    let added=0,updated=0;
    preview.forEach(p=>{
      const idx=existing.findIndex(e=>e.nombre?.toLowerCase()===p.nombre?.toLowerCase());
      if(idx>-1){existing[idx]={...existing[idx],...p,id:existing[idx].id};updated++;}
      else{existing.push(p);added++;}
    });
    setProds(existing);
    LS.set(KPROD,existing);
    setPreview([]);
    setMsg(added+' productos agregados, '+updated+' actualizados.');
    setImporting(false);
  };

  const exportCSV=()=>{
    const headers='nombre,stock,unidad,precio,rop,proveedor';
    const rows=prods.map(p=>[p.nombre||p.name||'',p.stock||0,p.unidad||p.unit||'u',p.precio||p.price||0,p.rop||5,p.proveedor||''].join(',')).join('\n');
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
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Importa productos desde CSV o Excel exportado como CSV</p>
        </div>
        <button onClick={exportCSV} style={{padding:'8px 18px',border:'2px solid '+G,background:'#fff',color:G,borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
          &#8659; Exportar productos CSV
        </button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Instrucciones */}
      <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:'#92400e',marginBottom:8}}>Como preparar el archivo CSV:</div>
        <div style={{fontSize:13,color:'#78350f',lineHeight:1.7}}>
          1. Abre Excel o Google Sheets<br/>
          2. La primera fila debe tener los encabezados:<br/>
          <code style={{background:'#fef3c7',padding:'2px 8px',borderRadius:4,fontFamily:'monospace',fontSize:12}}>nombre, stock, unidad, precio, rop, proveedor</code><br/>
          3. Guarda como CSV (separado por comas)<br/>
          4. Sube el archivo abajo
        </div>
        <div style={{marginTop:10,fontSize:12,color:'#92400e'}}>
          Columnas reconocidas: <strong>nombre/name/producto/descripcion, stock/cantidad/qty, unidad/unit/um, precio/price/costo, rop/stockmin/minimo, proveedor/supplier/marca</strong>
        </div>
      </div>

      {/* Upload */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:8}}>📄</div>
        <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:16}}>Seleccionar archivo CSV</div>
        <input type="file" accept=".csv,.txt" onChange={handleFile}
          style={{display:'block',margin:'0 auto',padding:'10px',border:'2px dashed #e5e7eb',borderRadius:8,cursor:'pointer',width:'100%',maxWidth:400,fontSize:13}} />
        <div style={{fontSize:11,color:'#aaa',marginTop:8}}>Formatos: .csv · Separador: coma, punto y coma, o tab</div>
      </div>

      {/* Preview */}
      {preview.length>0&&(
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#f9fafb',borderBottom:'2px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,color:'#374151'}}>Vista previa — {preview.length} productos</span>
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
                  {['Nombre','Stock','Unidad','Precio','Stock min','Proveedor'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0,20).map((p,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'7px 12px',fontWeight:500,color:'#1a1a1a'}}>{p.nombre}</td>
                    <td style={{padding:'7px 12px',fontWeight:700,color:G}}>{p.stock}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.unidad}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.precio>0?'$'+p.precio:'-'}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.rop}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.proveedor||'-'}</td>
                  </tr>
                ))}
                {preview.length>20&&<tr><td colSpan='6' style={{padding:'8px 12px',color:'#888',fontStyle:'italic',textAlign:'center'}}>...y {preview.length-20} mas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{background:'#fff',borderRadius:10,padding:'16px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,color:'#6b7280'}}>Productos actualmente en el sistema:</span>
        <span style={{fontSize:22,fontWeight:800,color:G}}>{prods.length}</span>
      </div>
    </section>
  );
}

export default ImportTab;

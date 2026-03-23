import React, { useState, useEffect } from 'react';
import { T, Modal, Sel, Field, Btn, Cap } from '../lib/ui.jsx';

const ExcelModal=({products,onApply,onClose})=>{
  const [text,setText]=useState("");
  const [headers,setHeaders]=useState([]);
  const [rows,setRows]=useState([]);
  const [cols,setCols]=useState({code:"",name:"",stock:""});
  const [preview,setPreview]=useState([]);

  useEffect(()=>{
    if(!text.trim())return;
    const lines=text.trim().split("\n").filter(Boolean);
    if(lines.length<2)return;
    const sep=lines[0].includes("\t")?"\t":",";
    const hdrs=lines[0].split(sep).map(h=>h.trim().replace(/"/g,""));
    const data=lines.slice(1).map(l=>{const cells=l.split(sep).map(c=>c.trim().replace(/"/g,""));const o={};hdrs.forEach((h,i)=>o[h]=cells[i]||"");return o;});
    setHeaders(hdrs);setRows(data);
    const g=cs=>hdrs.find(h=>cs.some(c=>h.toLowerCase().includes(c)))||"";
    setCols({code:g(["codigo","código","cod","ean","barcode"]),name:g(["nombre","descripcion","descripción","producto","articulo","artículo"]),stock:g(["stock","cantidad","existencia","saldo","disponible"])});
  },[text]);

  useEffect(()=>{
    if(!rows.length||!cols.stock){setPreview([]);return;}
    const m=[];
    rows.forEach(row=>{
      const cv=cols.code?row[cols.code]:"",nv=cols.name?row[cols.name]:"",sv=parseFloat(row[cols.stock]);
      if(isNaN(sv))return;
      const p=products.find(p=>(cv&&p.barcode&&(p.barcode===cv||p.barcode===cv.replace(/\D/g,"")))||(nv&&p.name.toLowerCase().includes(nv.toLowerCase().slice(0,5))));
      if(p)m.push({product:p,newStock:Math.round(sv)});
    });
    setPreview(m);
  },[rows,cols]);

  return(
    <Modal title="Actualizar stock desde Excel" sub="Importar desde Mercado" onClose={onClose} wide>
      <div style={{display:"grid",gap:16}}>
        <div style={{background:T.watchBg,borderLeft:`3px solid ${T.watch}`,padding:"12px 14px",borderRadius:4}}>
          <p style={{fontFamily:T.sans,fontSize:12,color:"#1e40af",lineHeight:1.6}}>
            <strong>Desde Mercado:</strong> Listado de stock → Exportar → Excel/CSV → seleccioná todo (Ctrl+A) → copiá (Ctrl+C) → pegá abajo.
          </p>
        </div>
        <Field label="Pegá el contenido del Excel aquí (Ctrl+V)">
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"Código\tNombre\tStock disponible\n7790895000123\tHarina 000\t150"}
            style={{width:"100%",height:100,fontFamily:"monospace",fontSize:11,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4}}/>
        </Field>
        {headers.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[{k:"code",l:"Columna código"},{k:"name",l:"Columna nombre"},{k:"stock",l:"Columna stock ★"}].map(cf=>(
              <Field key={cf.k} label={cf.l}>
                <Sel value={cols[cf.k]} onChange={e=>setCols(c=>({...c,[cf.k]:e.target.value}))}>
                  <option value="">— no usar —</option>
                  {headers.map(h=><option key={h} value={h}>{h}</option>)}
                </Sel>
              </Field>
            ))}
          </div>
        )}
        {preview.length>0&&(
          <div>
            <Cap>{preview.length} productos encontrados</Cap>
            <div style={{border:`1px solid ${T.border}`,borderRadius:4,marginTop:8,maxHeight:180,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted}}>
                  {["Producto","Stock actual","Nuevo stock","Δ"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {preview.map((r,i)=>{const diff=r.newStock-r.product.stock;return(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:500}}>{r.product.name}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,color:T.textSm}}>{r.product.stock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{r.newStock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:diff>=0?T.ok:T.danger}}>{diff>=0?"+":""}{diff}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>preview.length&&onApply(preview)} full disabled={!preview.length}>Aplicar actualización ({preview.length} productos)</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA SCANNER  (ZXing — Google barcode library)

export default ExcelModal;

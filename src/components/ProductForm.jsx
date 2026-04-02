import React, { useState, useRef } from 'react';
import { T, totalLead, rop, safetyStock, eoq, Inp, Sel, Field, Btn, Cap } from '../lib/ui.jsx';

const ProductForm=({product,suppliers,onSave,onClose})=>{
  const blank={name:"",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:0,precioVenta:0,iva_rate:22,imagen_url:"",descripcion:"",history:[]};
  const [f,setF]=useState(product?{...product}:blank);

  // WA template in localStorage
  // wa template — read from localStorage, not used in current form UI
  const [_csvMsg, setCsvMsg] = useState('');
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const [csv,setCsv]=useState(product?.history?.map(h=>`${h.month},${h.consumed}`).join("\n")||"");
  const bRef=useRef();
  const parseCSV=()=>{
    try{
      const rows=csv.trim().split("\n").map(r=>{const[m,c]=r.split(",");return{month:m?.trim(),consumed:+c?.trim()};}).filter(r=>r.month&&!isNaN(r.consumed)&&r.consumed>0);
      if(!rows.length){setCsvMsg("Sin datos válidos. Formato: YYYY-MM,cantidad");return;}
      setF(p=>({...p,history:rows}));
    }catch{setCsvMsg("Formato incorrecto. Usar: YYYY-MM,cantidad");}
  };
  const sup=suppliers.find(s=>s.id===f.supplierId);
  const lead=sup?totalLead(sup):0;
  const r=f.history.length?rop(f.history,lead):null;
  const ss=f.history.length?safetyStock(f.history,lead):null;
  const eq=f.history.length&&f.unitCost?eoq(f.history,f.unitCost):null;
  return(
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label="Nombre del producto"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Harina 000"/></Field>
        <Field label="Código de barras (EAN)">
          <div style={{display:"flex",gap:6}}>
            <Inp inputRef={bRef} value={f.barcode} onChange={e=>set("barcode",e.target.value)} placeholder="Escanear o tipear"/>
            <button onClick={()=>bRef.current?.focus()} style={{border:`1px solid ${T.border}`,background:T.muted,padding:"0 10px",cursor:"pointer",fontSize:15,color:T.textSm,borderRadius:4}} title="Foco para scanner">▦</button>
          </div>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <Field label="Proveedor / Origen">
          <Sel value={f.supplierId} onChange={e=>set("supplierId",e.target.value)}>
            {suppliers.map(s=><option key={s.id} value={s.id}>[{s.flag}] {s.name} — {totalLead(s)}d</option>)}
          </Sel>
        </Field>
        <Field label="Unidad"><Inp value={f.unit} onChange={e=>set("unit",e.target.value)} placeholder="kg, lt, u..."/></Field>
        <Field label="Costo unitario (USD)">
          <Inp type="number" step="0.01" value={f.unitCost} onChange={e=>set("unitCost",+e.target.value)}/>
          {f.costSource&&<div style={{fontFamily:T.sans,fontSize:10,color:T.green,marginTop:4,fontWeight:600}}>⚡ {f.costSource}{f.costUpdatedAt?' · '+new Date(f.costUpdatedAt).toLocaleDateString('es-UY',{day:'2-digit',month:'short'}):''}</div>}
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label="Precio de venta (USD)">
          <Inp type="number" step="0.01" value={f.precioVenta||f.precio_venta||0} onChange={e=>set("precioVenta",+e.target.value)}/>
        </Field>
        <Field label="IVA" hint="Tasa de impuesto al valor agregado">
          <Sel value={f.iva_rate||22} onChange={e=>set("iva_rate",+e.target.value)}>
            <option value={0}>0% — Exento</option>
            <option value={10}>10% — Tasa reducida</option>
            <option value={22}>22% — Tasa general</option>
          </Sel>
        </Field>
      </div>
      <Field label="Foto del producto (URL)">
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <Inp value={f.imagen_url||""} onChange={e=>set("imagen_url",e.target.value)} placeholder="https://... URL de la imagen"/>
          {f.imagen_url&&(
            <img src={f.imagen_url} alt="preview" onError={e=>e.target.style.display="none"}
              style={{width:56,height:56,objectFit:"cover",borderRadius:8,border:`1px solid ${T.border}`,flexShrink:0}}/>
          )}
        </div>
      </Field>
      <Field label="Descripción / Ficha técnica" hint="Opcional — aparece en el catálogo al hacer click en el producto">
        <textarea value={f.descripcion||""} onChange={e=>set("descripcion",e.target.value)}
          placeholder="Usos, presentaciones, características técnicas, envases disponibles..."
          style={{width:"100%",minHeight:80,fontFamily:"inherit",fontSize:13,border:`1px solid ${T.border}`,borderRadius:6,padding:"9px 11px",resize:"vertical",background:T.muted,color:T.text,boxSizing:"border-box"}}/>
      </Field>
      <Field label="Stock actual"><Inp type="number" value={f.stock} onChange={e=>set("stock",+e.target.value)}/></Field>
      {r!==null&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Punto de pedido (ROP)",v:`${r} ${f.unit}`,h:"Pedir cuando llegue a este nivel"},{l:"Stock de seguridad",v:`${ss} ${f.unit}`,h:"Buffer 95% nivel de servicio"},{l:"Cantidad óptima (EOQ)",v:eq?`${eq} ${f.unit}`:"—",h:"Minimiza costos"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"12px 14px"}}>
              <Cap>{s.l}</Cap>
              <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text,margin:"4px 0 2px"}}>{s.v}</div>
              <p style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{s.h}</p>
            </div>
          ))}
        </div>
      )}
      {f.unitCost>0&&f.precioVenta>0&&(()=>{
        const margen=((f.precioVenta-f.unitCost)/f.precioVenta*100);
        const color=margen<0?T.red:margen<15?T.amber:T.green;
        const bgColor=margen<0?T.redBg:margen<15?T.amberBg:T.greenBg;
        return(
          <div style={{background:bgColor,border:`1px solid ${margen<0?T.redBd:margen<15?'#fde68a':T.greenBd}`,borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:T.sans,fontSize:12,color,fontWeight:600}}>Margen estimado</div>
            <div style={{display:'flex',gap:20,alignItems:'center'}}>
              <span style={{fontFamily:T.sans,fontSize:13,color,fontWeight:700}}>{margen.toFixed(1)}%</span>
              <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Ganancia: ${(f.precioVenta-f.unitCost).toFixed(2)} / {f.unit||'u'}</span>
            </div>
          </div>
        );
      })()}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <Field label="Historial de consumo mensual" hint="Pegá desde Excel: YYYY-MM,cantidad — una línea por mes. Más historial = cálculos más precisos.">
          <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder={"2024-09,410\n2024-10,420\n2024-11,380\n2024-12,460\n2025-01,410\n2025-02,430"}
            style={{width:"100%",height:90,fontFamily:"monospace",fontSize:12,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4,marginTop:5}}/>
          <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
            <Btn onClick={parseCSV}  variant="ghost" small>Importar historial</Btn>
            {f.history.length>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ {f.history.length} meses · prom. {Math.round(f.history.reduce((s,h)=>s+h.consumed,0)/f.history.length)} {f.unit}/mes</span>}
          </div>
        </Field>
      </div>
      <div style={{display:"flex",gap:10,paddingTop:4}}>
        <Btn onClick={()=>onSave(f)} full>{product?"Guardar cambios":"Agregar producto"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

export default ProductForm;

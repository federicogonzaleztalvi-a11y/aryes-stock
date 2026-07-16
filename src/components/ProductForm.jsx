import ImageUpload from './ImageUpload.jsx';
import { getOrgId } from '../lib/constants.js';
import { getTaxConfig } from '../lib/taxConfig.js';
import React, { useState, useRef } from 'react';
import { T, totalLead, rop, safetyStock, eoq, Inp, Sel, Field, Btn, Cap } from '../lib/ui.jsx';

const ProductForm=({product,suppliers,onSave,onClose,brandCfg,categories=[],subcatsByCat={}})=>{
  const taxCfg=getTaxConfig(brandCfg?.tax_country||"UY");
  const blank={name:"",codigo:"",barcode:"",supplierId:"",unit:"kg",stock:0,unitCost:0,precioVenta:0,iva_rate:taxCfg.defaultRate,imagen_url:"",descripcion:"",history:[],volume_tiers:[],variants:{label:"Color",options:[]}};
  const normVariants=(v)=>{const o=v&&typeof v==="object"&&!Array.isArray(v)?v:{};return{label:o.label??"Color",options:Array.isArray(o.options)?o.options:[]};};
  const [f,setF]=useState(product?{...product,volume_tiers:Array.isArray(product.volume_tiers)?product.volume_tiers:[],variants:normVariants(product.variants)}:blank);

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
  // Los descuentos por volumen y por caja ahora se cargan por producto DENTRO de
  // cada lista de precios (modelo v2). Acá solo se preserva lo que ya tenía el
  // producto (volume_tiers) para no perder datos al editar; ya no se edita acá.
  const cleanTiers=(arr)=>(Array.isArray(arr)?arr:[])
    .map(t=>({min:Math.floor(Number(t.min)),dto:Number(t.dto)}))
    .filter(t=>Number.isFinite(t.min)&&t.min>1&&Number.isFinite(t.dto)&&t.dto>0&&t.dto<=100)
    .sort((a,b)=>a.min-b.min);

  // Variantes ({label, options:[{id,label,sku,color_hex}]}). Comparten precio/stock
  // del padre; el cliente las elige en el portal. Genérico (colores, sabores, talles).
  const variants=normVariants(f.variants);
  const setVarLabel=(v)=>setF(p=>({...p,variants:{...normVariants(p.variants),label:v}}));
  const addVar=()=>setF(p=>{const cur=normVariants(p.variants);return{...p,variants:{...cur,options:[...cur.options,{id:"",label:"",sku:"",color_hex:""}]}};});
  const updVar=(i,k,v)=>setF(p=>{const cur=normVariants(p.variants);const o=[...cur.options];o[i]={...o[i],[k]:v};return{...p,variants:{...cur,options:o}};});
  const rmVar=(i)=>setF(p=>{const cur=normVariants(p.variants);return{...p,variants:{...cur,options:cur.options.filter((_,j)=>j!==i)}};});
  // Reordenar variantes arrastrando desde el agarre (⠿). El orden del array es el
  // orden en que el cliente las ve en el portal, así que reordenar acá = reordenar
  // en el portal. Pointer events → anda igual en mouse y touch.
  const reorderVar=(from,to)=>setF(p=>{const cur=normVariants(p.variants);const o=[...cur.options];if(from<0||from>=o.length||to<0||to>=o.length||from===to)return p;const[m]=o.splice(from,1);o.splice(to,0,m);return{...p,variants:{...cur,options:o}};});
  const [dragIdx,setDragIdx]=useState(null);
  const rowRefs=useRef([]);
  const onHandleDown=(i)=>(e)=>{e.preventDefault();setDragIdx(i);try{e.target.setPointerCapture(e.pointerId);}catch{/* noop */}};
  const onHandleMove=(e)=>{
    if(dragIdx===null)return;
    const y=e.clientY;
    let target=rowRefs.current.length-1;
    for(let j=0;j<rowRefs.current.length;j++){const el=rowRefs.current[j];if(!el)continue;const r=el.getBoundingClientRect();if(y<r.top+r.height/2){target=j;break;}}
    if(target!==dragIdx){reorderVar(dragIdx,target);setDragIdx(target);}
  };
  const onHandleUp=(e)=>{setDragIdx(null);try{e.target.releasePointerCapture(e.pointerId);}catch{/* noop */}};
  const cleanVariants=(v)=>{const cur=normVariants(v);const seen=new Set();const options=cur.options
    .map(o=>{const label=String(o.label||"").trim();if(!label)return null;const id=String(o.id||label).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||label;return{id,label,sku:String(o.sku||"").trim(),color_hex:/^#[0-9a-fA-F]{6}$/.test(String(o.color_hex||""))?o.color_hex:""};})
    .filter(o=>o&&!seen.has(o.id)&&seen.add(o.id));
    return options.length?{label:String(cur.label||"Variante").trim()||"Variante",options}:{};};

  const sup=suppliers.find(s=>s.id===f.supplierId);
  const lead=sup?totalLead(sup):0;
  const r=f.history.length?rop(f.history,lead):null;
  const ss=f.history.length?safetyStock(f.history,lead):null;
  const eq=f.history.length&&f.unitCost?eoq(f.history,f.unitCost):null;
  return(
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label="Nombre del producto"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Harina 000"/></Field>
        <Field label="Código / SKU"><Inp value={f.codigo||""} onChange={e=>set("codigo",e.target.value)} placeholder="Ej: QCO-001"/></Field>
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
            <option value="">— Seleccioná un proveedor —</option>
            {suppliers.map(s=><option key={s.id} value={s.id}>[{s.flag}] {s.name} — {totalLead(s)}d</option>)}
          </Sel>
          {!suppliers.length && <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:4}}>Aún no cargaste proveedores. Creá uno desde la sección Proveedores.</p>}
        </Field>
        <Field label="Unidad"><Inp value={f.unit} onChange={e=>set("unit",e.target.value)} placeholder="kg, lt, u..."/></Field>
        <Field label="Categoría" hint="Agrupa el producto en el portal. Escribí una nueva o elegí una existente. Vacío = sin categoría.">
          <input list="pf-cat-list" value={f.category||""} onChange={e=>set("category",e.target.value)} placeholder="Ej: Lácteos"
            style={{width:"100%",boxSizing:"border-box",fontFamily:T.sans,fontSize:13,color:T.text,background:T.card,border:`1px solid ${T.border}`,padding:"9px 11px",borderRadius:4}}/>
          <datalist id="pf-cat-list">{categories.map(c=><option key={c} value={c}/>)}</datalist>
        </Field>
        <Field label="Subcategoría" hint="Opcional. Sub-nivel dentro de la categoría (ej: dentro de Bebidas → Gaseosas). Gestioná las opciones desde el botón Categorías.">
          <input list="pf-subcat-list" value={f.subcategoria||""} onChange={e=>set("subcategoria",e.target.value)} placeholder={f.category?`Ej: subcategoría de ${f.category}`:"Elegí primero una categoría"} disabled={!f.category}
            style={{width:"100%",boxSizing:"border-box",fontFamily:T.sans,fontSize:13,color:T.text,background:f.category?T.card:"#f5f5f0",border:`1px solid ${T.border}`,padding:"9px 11px",borderRadius:4}}/>
          <datalist id="pf-subcat-list">{[...(subcatsByCat[f.category]||[])].map(s=><option key={s} value={s}/>)}</datalist>
        </Field>
        <Field label={"Costo unitario (" + taxCfg.currency + ")"}>
          <Inp type="number" step="0.01" min="0" placeholder="0.00" value={f.unitCost||""} onChange={e=>set("unitCost",e.target.value===""?0:+e.target.value)}/>
          {f.costSource&&<div style={{fontFamily:T.sans,fontSize:10,color:T.green,marginTop:4,fontWeight:600}}>⚡ {f.costSource}{f.costUpdatedAt?' · '+new Date(f.costUpdatedAt).toLocaleDateString('es',{day:'2-digit',month:'short'}):''}</div>}
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label={"Precio de venta (" + taxCfg.currency + ")"}>
          <Inp type="number" step="0.01" min="0" placeholder="0.00" value={f.precioVenta||f.precio_venta||""} onChange={e=>set("precioVenta",e.target.value===""?0:+e.target.value)}/>
        </Field>
        <Field label={taxCfg.taxName} hint={"Tasa de " + taxCfg.taxName + " (" + taxCfg.country + ")"}>
          <Sel value={f.iva_rate!=null?f.iva_rate:taxCfg.defaultRate} onChange={e=>set("iva_rate",+e.target.value)}>
            {taxCfg.rates.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            {!taxCfg.rates.some(r=>r.value===(f.iva_rate||0))&&<option value={f.iva_rate}>{f.iva_rate}% — Personalizado</option>}
          </Sel>
          <input type="number" min={0} max={99} step={0.5} value={f.iva_rate!=null?f.iva_rate:taxCfg.defaultRate}
            onChange={e=>set("iva_rate",+e.target.value)}
            style={{width:70,padding:"5px 8px",borderRadius:6,border:"1px solid #e2e2de",fontSize:12,marginTop:4,textAlign:"center"}}
            placeholder="%"/>
        </Field>
      </div>
      <Field label="Foto del producto">
        <ImageUpload value={f.imagen_url||""} onChange={function(url){set("imagen_url",url);}} orgId={getOrgId()} />
      </Field>
      <Field label="Descripción / Ficha técnica" hint="Opcional — aparece en el catálogo al hacer click en el producto">
        <textarea value={f.descripcion||""} onChange={e=>set("descripcion",e.target.value)}
          placeholder="Usos, presentaciones, características técnicas, envases disponibles..."
          style={{width:"100%",minHeight:80,fontFamily:"inherit",fontSize:13,border:`1px solid ${T.border}`,borderRadius:6,padding:"9px 11px",resize:"vertical",background:T.muted,color:T.text,boxSizing:"border-box"}}/>
      </Field>
      <Field label="Unidades por caja" hint="Opcional — cuántas unidades trae una caja cerrada. Es solo el dato físico; el descuento por caja se configura en cada lista de precios.">
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Caja de</span>
          <input type="number" min={0} step={1} value={f.unidades_por_caja||""} onChange={e=>set("unidades_por_caja",e.target.value===""?0:Math.max(0,Math.floor(+e.target.value)))} placeholder="6"
            style={{width:80,padding:"7px 9px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:13,background:T.muted,color:T.text}}/>
          <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>unidades</span>
        </div>
      </Field>
      <Field label="Variantes" hint="Opcional — opciones que el cliente elige en el portal (colores, sabores, talles...). Comparten precio, IVA y stock de este producto. Ej: un colorante con 16 colores en una sola card.">
        <div style={{display:"grid",gap:8}}>
          {variants.options.length>0&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Etiqueta del grupo</span>
              <Inp value={variants.label} onChange={e=>setVarLabel(e.target.value)} placeholder="Color"/>
            </div>
          )}
          {variants.options.length===0&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,margin:0}}>Sin variantes. Agregá una para que el cliente elija (ej: colores) en una sola card.</p>}
          {variants.options.map((o,i)=>(
            <div key={i} ref={el=>{rowRefs.current[i]=el;}} style={{display:"flex",gap:8,alignItems:"center",opacity:dragIdx===i?0.5:1,background:dragIdx===i?T.hover:"transparent",borderRadius:6,transition:"opacity .1s"}}>
              <button onPointerDown={onHandleDown(i)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} title="Arrastrar para reordenar"
                style={{border:`1px solid ${T.border}`,background:T.muted,color:T.textSm,borderRadius:6,width:24,height:34,cursor:dragIdx===i?"grabbing":"grab",fontSize:14,lineHeight:1,padding:0,flexShrink:0,touchAction:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>⠿</button>
              <input type="color" value={o.color_hex||"#cccccc"} onChange={e=>updVar(i,"color_hex",e.target.value)} title="Color (opcional)"
                style={{width:34,height:34,padding:0,border:`1px solid ${T.border}`,borderRadius:6,background:T.muted,cursor:"pointer",flexShrink:0}}/>
              <input value={o.label} onChange={e=>updVar(i,"label",e.target.value)} placeholder="Nombre (ej: Rojo)"
                style={{flex:1,minWidth:0,padding:"7px 9px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:13,background:T.muted,color:T.text}}/>
              <input value={o.sku} onChange={e=>updVar(i,"sku",e.target.value)} placeholder="SKU (opcional)"
                style={{width:120,padding:"7px 9px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:13,background:T.muted,color:T.text}}/>
              <button onClick={()=>rmVar(i)} title="Quitar variante" style={{border:`1px solid ${T.border}`,background:T.muted,color:T.red,borderRadius:6,width:30,height:30,cursor:"pointer",fontSize:16,lineHeight:1,flexShrink:0}}>×</button>
            </div>
          ))}
          <Btn onClick={addVar} variant="ghost" small>+ Agregar variante</Btn>
        </div>
      </Field>
      <Field label="Stock actual"><Inp type="number" min="0" placeholder="0" value={f.stock||""} onChange={e=>set("stock",e.target.value===""?0:+e.target.value)}/></Field>
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
              <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Ganancia: {taxCfg.currencySymbol}{(f.precioVenta-f.unitCost).toFixed(2)} / {f.unit||'u'}</span>
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
        <Btn onClick={()=>onSave({...f,volume_tiers:cleanTiers(f.volume_tiers),variants:cleanVariants(f.variants)})} full>{product?"Guardar cambios":"Agregar producto"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

export default ProductForm;

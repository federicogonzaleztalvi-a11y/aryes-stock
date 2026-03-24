import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { LS } from '../lib/constants.js';
import { T, Cap, Btn } from '../lib/ui.jsx';
import { LOVABLE_CATALOG, IMP_BRAND_COLORS, IMP_SUP_LABEL, IMP_SUP_COLOR } from './importer/catalog-data.js';

// Sub-tab components — each in their own file under ./importer/
// Imported lazily here so ImporterTab.jsx stays as a thin shell (~190 lines).
// Full component list:
//   LoginScreen     — authentication screen used within importer
//   UsersTab        — user management (admin only)
//   LotsTab         — lot/expiry tracking
//   ExcelImportTab  — import stock from Excel file
//   DashboardExtra  — purchase order PDF + mini charts
//   PriceHistoryTab — price history per product
//   ClientsTab      — client management
//   MovementsTab    — stock movement log
//   EmailConfigTab  — email alert configuration
// These are not lazy-loaded at the router level (ImporterTab itself is lazy-loaded
// from App.jsx), so direct imports here are fine.
export { LOVABLE_CATALOG, IMP_BRAND_COLORS, IMP_SUP_LABEL, IMP_SUP_COLOR };

function ImporterTab({onDone}){
  const { confirm, ConfirmDialog } = useConfirm();
  const [step,setStep]=useState("select");
  const [sel,setSel]=useState(()=>Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));
  const [fb,setFb]=useState("all");
  const [fs,setFs]=useState("all");
  const [search,setSearch]=useState("");
  const [progress,setProgress]=useState(0);
  const [result,setResult]=useState(null);
  const existingCount=LS.get("aryes6-products",[]).length;

  const brands=["all",...Object.keys(IMP_BRAND_COLORS)];
  const suppliers=["all","arg","ecu","eur"];

  const filtered=LOVABLE_CATALOG.filter(p=>{
    const mb=fb==="all"||p.brand===fb;
    const ms=fs==="all"||p.supplierId===fs;
    const mq=!search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mb&&ms&&mq;
  });

  const toggleSel=(id)=>setSel(prev=>({...prev,[id]:!prev[id]}));
  const selAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=true;});setSel(s);};
  const deselAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=false;});setSel(s);};
  const selAllCatalog=()=>setSel(Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));

  const selCount=Object.values(sel).filter(Boolean).length;
  const selProducts=LOVABLE_CATALOG.filter(p=>sel[p.id]);

  const doImport=async()=>{
    setStep("importing");
    const out=[];
    for(let i=0;i<selProducts.length;i++){
      setProgress(Math.round(((i+1)/selProducts.length)*100));
      await new Promise(r=>setTimeout(r,6));
      const p=selProducts[i];
      if(!p.name) continue; // FIX 8: skip items without name
      if(typeof p.stock==='number'&&p.stock<0) { p.stock=0; } // guard negative stock
      out.push({id:crypto.randomUUID(),name:p.name,description:p.description,unitCost:p.unitCost,unit:p.unit,stock:Math.max(0,p.stock||0),minStock:p.minStock||Math.max(5,Math.floor(p.stock/4)),supplierId:p.supplierId,brand:p.brand,category:p.category,dailyUsage:p.dailyUsage||0.5,createdAt:new Date().toISOString(),source:"lovable"});
    }
    // Snapshot for undo
    LS.set("aryes-last-import-snapshot", LS.get("aryes6-products",[]));
    LS.set("aryes6-products",out);
    setResult({total:out.length});
    setStep("done");
  };

  const pill=(active)=>({background:active?T.green:"#f0ece4",color:active?"#fff":T.textSm,border:"none",borderRadius:20,padding:"5px 13px",fontSize:12,cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap"});
  const byBrand=selProducts.reduce((a,p)=>{(a[p.brand]=a[p.brand]||[]).push(p);return a;},{});
  const bySup=selProducts.reduce((a,p)=>{a[p.supplierId]=(a[p.supplierId]||0)+1;return a;},{});

  if(step==="done")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:48,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:52,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.green,marginBottom:8}}>Inventario cargado</h2>
        <p style={{color:T.textSm,marginBottom:32}}>Los productos demo fueron eliminados y reemplazados por el catálogo real</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:32}}>
          {[{n:result.total,l:"productos cargados",c:T.green},{n:11,l:"marcas",c:"#e67e22"},{n:3,l:"proveedores",c:"#8e44ad"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,borderRadius:10,padding:"16px 24px",textAlign:"center",minWidth:120}}>
              <div style={{fontSize:32,fontWeight:700,color:s.c}}>{s.n}</div>
              <div style={{color:T.textSm,fontSize:13}}>{s.l}</div>
            </div>
          ))}
        </div>
        <Btn onClick={onDone}>Ir al inventario →</Btn>
      </div>
    </div>
  );

  if(step==="importing")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:64,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:44,marginBottom:20}}>⏳</div>
        <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginBottom:6}}>Cargando inventario...</h2>
        <p style={{color:T.textSm,marginBottom:28,fontSize:14}}>{progress}% — {Math.round(selProducts.length*progress/100)} de {selProducts.length} productos</p>
        <div style={{background:T.muted,borderRadius:20,height:8,maxWidth:360,margin:"0 auto"}}>
          <div style={{background:T.green,borderRadius:20,height:8,width:`${progress}%`,transition:"width .15s"}}/>
        </div>
      </div>
    </div>
  );

  if(step==="preview")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
        <div style={{display:"flex",gap:10}}><Btn secondary onClick={()=>setStep("select")}>← Volver</Btn><Btn onClick={doImport}>✓ Cargar {selProducts.length} productos</Btn></div>
      </div>
      <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"16px 20px"}}>
        <div style={{fontWeight:600,color:"#b45309",marginBottom:6}}>⚠ Se borrarán los productos demo</div>
        <div style={{fontSize:13,color:"#78350f"}}>El sistema tiene <strong>{existingCount}</strong> producto{existingCount!==1?"s":""} actualmente. Al confirmar, <strong>se eliminarán todos</strong> y se cargarán los {selProducts.length} productos seleccionados.</div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
          <div style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
            <div style={{fontSize:28,fontWeight:700,color:T.green}}>{selProducts.length}</div>
            <div style={{fontSize:12,color:T.textSm}}>a cargar</div>
          </div>
          {Object.entries(bySup).map(([s,c])=>(
            <div key={s} style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
              <div style={{fontSize:22,fontWeight:700,color:IMP_SUP_COLOR[s]}}>{c}</div>
              <div style={{fontSize:12,color:T.textSm}}>{IMP_SUP_LABEL[s]}</div>
            </div>
          ))}
        </div>
        <Cap style={{marginBottom:10}}>Desglose por marca</Cap>
        <div style={{maxHeight:320,overflow:"auto"}}>
          {Object.entries(byBrand).sort((a,b)=>b[1].length-a[1].length).map(([brand,prods])=>(
            <div key={brand} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:IMP_BRAND_COLORS[brand]||"#ccc",flexShrink:0}}/>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{brand}</span>
              <span style={{background:(IMP_BRAND_COLORS[brand]||"#888")+"18",color:IMP_BRAND_COLORS[brand]||"#888",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>{prods.length} productos</span>
              <span style={{fontSize:12,color:IMP_SUP_COLOR[prods[0].supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prods[0].supplierId]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const visByBrand={};
  filtered.forEach(p=>{visByBrand[p.brand]=(visByBrand[p.brand]||0)+1;});

  return(
    <>{ConfirmDialog}<div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar catálogo</h1></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {existingCount>0&&<span style={{fontSize:12,background:"#fff8e1",color:"#b45309",borderRadius:6,padding:"4px 10px"}}>⚠ {existingCount} productos actuales serán reemplazados</span>}
          <span style={{color:T.textSm,fontSize:13,fontWeight:600}}>{selCount} seleccionados</span>
          <Btn disabled={selCount===0} onClick={()=>setStep("preview")} style={{opacity:selCount===0?.4:1}}>Continuar →</Btn>
        </div>
      </div>
      <div style={{background:"#f0f7ed",borderRadius:10,padding:"14px 18px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",border:"1px solid #c8e0b8"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.green}}>Selección rápida:</span>
        <Btn onClick={selAllCatalog}>★ Todos los 249 productos</Btn>
        <Btn secondary onClick={selAll}>✓ Visibles ({filtered.length})</Btn>
        <Btn secondary onClick={deselAll}>✕ Deseleccionar visibles</Btn>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <input placeholder="🔍 Buscar por nombre, marca o categoría..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 14px",fontSize:13,background:T.cardWarm,width:"100%",marginBottom:12}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Marca:</span>
          {brands.map(b=>(
            <button key={b} onClick={()=>setFb(b)} style={pill(fb===b)}>
              {b==="all"?"Todas":b}{b!=="all"&&visByBrand[b]?` (${visByBrand[b]})`:""}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Proveedor:</span>
          {suppliers.map(s=>(
            <button key={s} onClick={()=>setFs(s)} style={pill(fs===s)}>
              {s==="all"?"Todos":IMP_SUP_LABEL[s]}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm}}>{filtered.length} productos · {selCount} seleccionados</span>
        </div>
        <div style={{maxHeight:480,overflow:"auto",display:"grid",gap:4}}>
          {filtered.map(prod=>{
            const isSel=!!sel[prod.id];
            return(
              <div key={prod.id} onClick={()=>toggleSel(prod.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",borderRadius:8,background:isSel?"#f0f7ed":T.cardWarm,border:`1px solid ${isSel?T.green+"40":"transparent"}`,cursor:"pointer",transition:"all .12s"}}>
                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{width:15,height:15,accentColor:T.green,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13,color:T.text}}>{prod.name}</span>
                    <span style={{background:(IMP_BRAND_COLORS[prod.brand]||"#888")+"18",color:IMP_BRAND_COLORS[prod.brand]||"#888",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{prod.brand}</span>
                    <span style={{fontSize:11,color:T.textXs}}>{prod.category}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{prod.unitCost>0?`$${prod.unitCost.toFixed(0)} / ${prod.unit}`:"—"}</div>
              {prod.salePrice>0&&<span style={{fontSize:11,color:'#16a34a',marginLeft:8}}>Venta: $${prod.salePrice.toFixed(2)} · <strong>${prod.unitCost>0?Math.round((prod.salePrice-prod.unitCost)/prod.salePrice*100):0}% margen</strong></span>}
                  <div style={{fontSize:11,color:IMP_SUP_COLOR[prod.supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prod.supplierId]}</div>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:T.textXs}}>Sin resultados</div>}
        </div>
      </div>
    </div></>
  );
}


// eslint-disable-next-line no-unused-vars

export default ImporterTab;

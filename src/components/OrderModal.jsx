import React, { useState, useEffect } from 'react';
import { T, totalLead, avgDaily, rop, safetyStock, eoq, alertLevel, ALERT_CFG,
         Modal, Inp, Btn, Cap, StockBar, fmtDate, fmtShort } from '../lib/ui.jsx';

const OrderModal=({product,supplier,onConfirm,onClose,suggestedQty})=>{
  const lead=totalLead(supplier);
  const daily=avgDaily(product.history);
  const r=rop(product.history,lead);
  const ss=safetyStock(product.history,lead);
  const eq=eoq(product.history,product.unitCost);
  const {level,daysToROP,daysOut}=alertLevel(product,supplier);
  const initQty=suggestedQty||eq||Math.ceil(daily*lead*1.5);
  const [qty,setQty]=useState(initQty);
  const [useEOQ,setUseEOQ]=useState(!suggestedQty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(useEOQ)setQty(eq||Math.ceil(daily*lead*1.5));},[useEOQ]);
  const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
  const stockAfter=product.stock+qty;
  const daysAfter=daily>0?Math.round(stockAfter/daily):999;
  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs=[{k:"preparation",l:"Preparación"},{k:"customs",l:"Aduana"},{k:"freight",l:"Flete"},{k:"warehouse",l:"Depósito"}];
  return(
    <Modal title={product.name} sub="Generar pedido de reabastecimiento" onClose={onClose} wide>
      <div style={{display:"grid",gap:20}}>
        {level!=="ok"&&(
          <div style={{background:ALERT_CFG[level].bg,border:`1px solid ${ALERT_CFG[level].bd}`,padding:"11px 14px",borderRadius:4,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:ALERT_CFG[level].dot,flexShrink:0,...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
            <span style={{fontFamily:T.sans,fontSize:12,color:ALERT_CFG[level].txt,fontWeight:600}}>
              {level==="order_now"?`Stock bajo el punto de pedido — quedan aprox. ${daysOut} días de existencia`:`El stock alcanza el punto de pedido en ${daysToROP} días — pedí antes del ${fmtShort(new Date(Date.now()+daysToROP*864e5))}`}
            </span>
          </div>
        )}
        {/* 4 metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Stock actual",v:`${product.stock} ${product.unit}`},{l:"Punto de pedido",v:`${r} ${product.unit}`,sub:"ROP"},{l:"Stock de seguridad",v:`${ss} ${product.unit}`,sub:"Safety"},{l:"Días restantes",v:`${daysOut<999?daysOut+"d":"∞"}`,c:daysOut<=lead?T.danger:T.text}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"13px 15px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <Cap>{s.l}</Cap>
                {s.sub&&<Cap style={{color:T.green,fontSize:9}}>{s.sub}</Cap>}
              </div>
              <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:s.c||T.text,marginTop:4}}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* Stock bar */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}>
            <Cap>Nivel de stock visual</Cap>
            <div style={{display:"flex",gap:12}}>
              {[["#fecaca","Stock seguridad"],[T.warning+"99","Punto de pedido"],[T.green+"99","Stock actual"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.sans,fontSize:10,color:T.textSm}}>
                  <span style={{width:10,height:6,background:c,borderRadius:1,display:"inline-block"}}/>{l}
                </span>
              ))}
            </div>
          </div>
          <StockBar stock={product.stock} r={r} ss={ss} max={Math.max(product.stock*1.6,r*2.5)}/>
        </div>
        {/* Timeline */}
        <div style={{background:T.cardWarm,borderRadius:6,padding:16,border:`1px solid ${T.border}`}}>
          <Cap>Timeline de entrega completo</Cap>
          <div style={{display:"flex",gap:2,marginTop:10,height:10,borderRadius:3,overflow:"hidden"}}>
            {tfs.map((tf,i)=><div key={tf.k} style={{flex:supplier.times[tf.k]||.1,background:tfCols[i]}} title={`${tf.l}: ${supplier.times[tf.k]}d`}/>)}
          </div>
          <div style={{display:"flex",gap:2,marginTop:7}}>
            {tfs.map((tf,i)=>(
              <div key={tf.k} style={{flex:supplier.times[tf.k]||.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[i]}}>{tf.l}</div>
                <div style={{fontFamily:T.sans,fontSize:9,color:T.textXs}}>{supplier.times[tf.k]}d</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Cap>Llegada estimada</Cap>
            <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.green}}>{fmtDate(arrival)}</div>
          </div>
        </div>
        {/* Qty */}
        <div>
          <Cap>Cantidad a pedir</Cap>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:10}}>
            <div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {suggestedQty && (
                  <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#d97706',fontWeight:600,marginBottom:8}}>
                    Cantidad sugerida por el sistema: <strong>{suggestedQty} {product.unit}</strong>
                  </div>
                )}
                {[{id:true,label:`EOQ — ${eq} ${product.unit}`,hint:"Óptimo por costo"},{id:false,label:"Manual",hint:"Ingresar cantidad"}].map(opt=>(
                  <button key={String(opt.id)} onClick={()=>setUseEOQ(opt.id)}
                    style={{flex:1,padding:"10px 12px",border:`1px solid ${useEOQ===opt.id?T.green:T.border}`,background:useEOQ===opt.id?T.greenBg:T.card,cursor:"pointer",textAlign:"left",borderRadius:4}}>
                    <div style={{fontFamily:T.sans,fontSize:11,fontWeight:600,color:useEOQ===opt.id?T.green:T.textMd}}>{opt.label}</div>
                    <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{opt.hint}</div>
                  </button>
                ))}
              </div>
              {!useEOQ&&<Inp type="number" value={qty} onChange={e=>setQty(Math.max(0,+e.target.value))} placeholder={`Cantidad en ${product.unit}`}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
              {[{l:"Cantidad",v:`${qty} ${product.unit}`},{l:"Costo total",v:`USD ${(qty*product.unitCost).toFixed(2)}`},{l:"Stock después",v:`${stockAfter} ${product.unit}`},{l:"Días de stock",v:`${daysAfter<999?daysAfter:999}d`}].map((s,i)=>(
                <div key={i} style={{background:T.cardWarm,padding:"10px 12px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:2}}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>onConfirm(qty)} full>Confirmar pedido · {qty} {product.unit} · USD {(qty*product.unitCost).toFixed(2)}</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT

export default OrderModal;

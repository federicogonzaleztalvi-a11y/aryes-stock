import React, { useState } from 'react';
import { T, Cap, Btn, Inp, Field } from '../lib/ui.jsx';

// ConfigInline extracted from App.jsx
export default function ConfigInline({suppliers, setSuppliers, settingsTab, setSettingsTab, emailCfg, setEmailCfg, enriched, sendAlertEmail, EmailSettings, totalLead, tfCols}) {
  return (
    <>
      <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Configuración</h1></div>
            </div>
            {/* Settings sub-tabs */}
            {(()=>{
              return(
                <div>
                  <div style={{display:"flex",gap:1,background:T.border,borderRadius:6,overflow:"hidden",maxWidth:400,marginBottom:24}}>
                    {[{id:"freight",l:"Tiempos de flete"},{id:"email",l:"Notificaciones email"}].map(st=>(
                      <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                        style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontFamily:T.sans,fontSize:12,fontWeight:600,
                          background:settingsTab===st.id?T.green:T.card,color:settingsTab===st.id?"#fff":T.textSm}}>
                        {st.l}
                      </button>
                    ))}
                  </div>
                  {settingsTab==="freight"&&(
                    <div style={{maxWidth:680}}>
                      <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginBottom:16,lineHeight:1.6}}>Estos valores determinan el ROP (punto de pedido). Actualizalos cuando cambien las condiciones logísticas.</p>
                      {suppliers.map(sup=>(
                        <div key={sup.id} style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                          <div style={{padding:"12px 18px",background:T.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap>
                            <Cap>Total: {totalLead(sup)} días</Cap>
                          </div>
                          <div style={{padding:"14px 18px",background:T.card}}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                              {[["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]].map(([k,l])=>(
                                <Field key={k} label={l}>
                                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                                    <Inp type="number" min="0" value={sup.times[k]} onChange={e=>setSuppliers(ss=>ss.map(s=>s.id===sup.id?{...s,times:{...s.times,[k]:Math.max(0,+e.target.value)}}:s))} style={{textAlign:"center"}}/>
                                    <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
                                  </div>
                                </Field>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginTop:12}}>
                              {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {settingsTab==="email"&&(
                    <EmailSettings
                      cfg={emailCfg}
                      setCfg={setEmailCfg}
                      enriched={enriched}
                      onTestSend={()=>{}}
                      onManualSend={(prods)=>sendAlertEmail(prods,emailCfg)}
                    />
                  )}
                </div>
              );
            })()}
          </div>

    </>
  );
}
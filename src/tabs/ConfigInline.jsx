import React, { useState, useEffect } from 'react';
import UsersTab from './UsersTab.jsx';
import { db } from '../lib/constants.js';
import { T, Cap, Inp, Field } from '../lib/ui.jsx';

export default function ConfigInline({
  session,
  suppliers, setSuppliers,
  settingsTab, setSettingsTab,
  emailCfg, setEmailCfg,
  enriched, sendAlertEmail, EmailSettings,
  totalLead, tfCols,
  brandCfg={}, setBrandCfg
}) {
  // ── Brand config state — top level, no IIFE ──────────────────────────────
  const [localBrand, setLocalBrand] = useState({
    name:       brandCfg.name       || '',
    logoUrl:    brandCfg.logoUrl    || '',
    color:      brandCfg.color      || '#3a7d1e',
    ownerPhone: brandCfg.ownerPhone || '',
  });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved,  setBrandSaved]  = useState(false);

  // Sync localBrand when parent brandCfg changes (e.g. after initial DB load)
  useEffect(() => {
    setLocalBrand({
      name:       brandCfg.name       || '',
      logoUrl:    brandCfg.logoUrl    || '',
      color:      brandCfg.color      || '#3a7d1e',
      ownerPhone: brandCfg.ownerPhone || '',
    });
  }, [brandCfg.name, brandCfg.logoUrl, brandCfg.color]);

  const saveBrand = async () => {
    setBrandSaving(true);
    try {
      await db.upsert('app_config',
        { key: 'brandcfg', value: localBrand, updated_at: new Date().toISOString() },
        'key'
      );
      setBrandCfg(localBrand);
      localStorage.setItem('aryes-brand', JSON.stringify(localBrand));
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 3000);
    } catch(e) {
      console.warn('[Stock] brand save failed', e);
    } finally {
      setBrandSaving(false);
    }
  };

  const inp2 = {
    padding: '8px 12px', border: '1px solid #e2e2de', borderRadius: 6,
    fontSize: 13, fontFamily: 'Inter,sans-serif', width: '100%', boxSizing: 'border-box',
  };

  return (
    <>
      <div className="au" style={{display:"grid",gap:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
          <div>
            <Cap style={{color:T.green}}>Sistema</Cap>
            <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Configuración</h1>
          </div>
        </div>

        <div>
          {/* Sub-tab bar */}
          <div style={{display:"flex",gap:1,background:T.border,borderRadius:6,overflow:"hidden",maxWidth:600,marginBottom:24}}>
            {[{id:"usuarios",l:"Usuarios"},{id:"marca",l:"Marca y empresa"},{id:"facturacion_cfg",l:"Facturación DGI"},{id:"freight",l:"Tiempos de flete"},{id:"email",l:"Notificaciones email"},{id:"integraciones",l:"Integraciones"}].map(st=>(
              <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontFamily:T.sans,fontSize:12,fontWeight:600,
                  background:settingsTab===st.id?T.green:T.card,color:settingsTab===st.id?"#fff":T.textSm}}>
                {st.l}
              </button>
            ))}
          </div>

          {/* ── USUARIOS ─────────────────────────────────────────────────── */}
          {settingsTab==="usuarios" && (
            <UsersTab session={session} />
          )}

          {/* ── MARCA ─────────────────────────────────────────────────────── */}
          {settingsTab==="marca" && (
            <div style={{maxWidth:560}}>
              <p style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginBottom:20,lineHeight:1.6}}>
                Estos datos aparecen en el sidebar y reemplazan el logo por defecto.
                Se guardan en la base de datos y aplican a todos los usuarios al próximo login.
              </p>
              <div style={{display:'grid',gap:16}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Nombre de la empresa</label>
                  <input
                    value={localBrand.name}
                    onChange={e=>setLocalBrand(b=>({...b,name:e.target.value}))}
                    placeholder='Ej: Mi Distribuidora S.A.'
                    style={inp2}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Aparece debajo del logo en el sidebar</div>
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>URL del logo</label>
                  <input
                    value={localBrand.logoUrl}
                    onChange={e=>setLocalBrand(b=>({...b,logoUrl:e.target.value}))}
                    placeholder='https://mi-empresa.com/logo.png'
                    style={inp2}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Imagen PNG/SVG pública. Si está vacío se usa el logo por defecto.</div>
                  {localBrand.logoUrl && (
                    <img src={localBrand.logoUrl} alt='preview'
                      style={{height:40,marginTop:8,objectFit:'contain',border:'1px solid #e2e2de',borderRadius:4,padding:4}}
                      onError={e=>e.target.style.display='none'}
                    />
                  )}
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Color principal</label>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <input type='color'
                      value={localBrand.color||'#3a7d1e'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{width:48,height:36,padding:2,border:'1px solid #e2e2de',borderRadius:6,cursor:'pointer'}}
                    />
                    <input
                      value={localBrand.color||'#3a7d1e'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{...inp2,width:120}}
                    />
                    <div style={{padding:'6px 14px',borderRadius:6,background:localBrand.color||'#3a7d1e',color:'#fff',fontSize:12,fontWeight:600}}>
                      Vista previa
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Teléfono para resumen WhatsApp</label>
                  <input
                    value={localBrand.ownerPhone||''}
                    onChange={e=>setLocalBrand(b=>({...b,ownerPhone:e.target.value}))}
                    placeholder='Ej: 59899123456 (con código de país)'
                    style={inp2}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Tu número de WhatsApp. El resumen diario se enviará directo a este número desde el Dashboard.</div>
                </div>

                <div style={{paddingTop:8,borderTop:'1px solid #e2e2de',display:'flex',alignItems:'center',gap:12}}>
                  <button onClick={saveBrand} disabled={brandSaving}
                    style={{padding:'9px 24px',background:brandSaving?'#9ca3af':(localBrand.color||'#3a7d1e'),color:'#fff',border:'none',borderRadius:8,cursor:brandSaving?'not-allowed':'pointer',fontWeight:600,fontSize:13}}>
                    {brandSaving?'Guardando…':'Guardar marca'}
                  </button>
                  {brandSaved && <span style={{color:'#3a7d1e',fontSize:13,fontWeight:600}}>✓ Guardado</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── FLETE ─────────────────────────────────────────────────────── */}
          {settingsTab==="freight" && (
            <div style={{maxWidth:680}}>
              <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginBottom:16,lineHeight:1.6}}>
                Estos valores determinan el ROP (punto de pedido). Actualizalos cuando cambien las condiciones logísticas.
              </p>
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
                            <Inp type="number" min="0" value={sup.times[k]}
                              onChange={e=>setSuppliers(ss=>ss.map(s=>s.id===sup.id?{...s,times:{...s.times,[k]:Math.max(0,+e.target.value)}}:s))}
                              style={{textAlign:"center"}}
                            />
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

          {/* ── EMAIL ─────────────────────────────────────────────────────── */}
          {settingsTab==="email" && (
            <EmailSettings
              cfg={emailCfg}
              setCfg={setEmailCfg}
              enriched={enriched}
              onTestSend={()=>{}}
              onManualSend={(prods)=>sendAlertEmail(prods,emailCfg)}
            />
          )}

          {/* ── FACTURACIÓN DGI ───────────────────────────────────────────── */}
          {settingsTab==="facturacion_cfg" && (
            <div style={{maxWidth:580}}>
              <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'14px 18px',marginBottom:24,display:'flex',gap:10}}>
                <span style={{fontSize:20}}>🔗</span>
                <div>
                  <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,fontWeight:700,color:'#1e40af',marginBottom:2}}>Proveedor habilitado por DGI</div>
                  <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#3b82f6'}}>
                    Para emitir CFEs con validez legal, configurá tu proveedor habilitado. Soportamos UCFE (Uruware) y pymo.uy.
                    Los CFEs se envían automáticamente al guardar.
                  </div>
                </div>
              </div>
              <div style={{display:'grid',gap:16}}>
                {[{id:'ucfe',name:'UCFE (Uruware)',desc:'Proveedor de Saico. Si ya tenés contrato con Uruware podés conectarlo directamente.',logo:'🏢'},
                  {id:'pymo',name:'pymo.uy',desc:'Proveedor moderno con API REST documentada. Plan desde USD 8/mes + CFEs.',logo:'⚡'},
                  {id:'sicfe',name:'Sicfe',desc:'Más de 11.000 clientes en Uruguay. Integración vía API REST.',logo:'🔒'}
                ].map(p=>(
                  <div key={p.id} style={{border:'1.5px solid #e2e2de',borderRadius:10,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#3a7d1e'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e2de'}>
                    <span style={{fontSize:28}}>{p.logo}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:14,fontWeight:700,color:'#1a1a18'}}>{p.name}</div>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>{p.desc}</div>
                    </div>
                    <span style={{background:'#f0f0ec',color:'#6a6a68',fontFamily:'DM Sans,Inter,sans-serif',fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:20}}>Próximamente</span>
                  </div>
                ))}
                <div style={{background:'#f9f9f7',borderRadius:8,padding:'12px 16px',fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68'}}>
                  ¿Tenés contrato con otro proveedor habilitado por DGI? <span style={{color:'#3a7d1e',fontWeight:600,cursor:'pointer'}}>Contactanos →</span>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRACIONES ─────────────────────────────────────────────── */}
          {settingsTab==="integraciones" && (
            <div style={{maxWidth:600}}>
              <p style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,color:'#6a6a68',marginBottom:20,lineHeight:1.6}}>
                Conectá la plataforma con otros sistemas. Las integraciones se activan sin código — solo configurás las credenciales.
              </p>
              <div style={{display:'grid',gap:10}}>
                {[
                  {icon:'📱',name:'WhatsApp Business',desc:'Enviá alertas de stock, notificaciones de pedidos y remitos por WhatsApp.',status:'disponible',color:'#16a34a'},
                  {icon:'📊',name:'Google Sheets',desc:'Exportá inventario y movimientos automáticamente a una hoja de cálculo.',status:'disponible',color:'#16a34a'},
                  {icon:'🏦',name:'BROU / Santander',desc:'Importá extractos bancarios automáticamente para conciliación.',status:'pronto',color:'#d97706'},
                  {icon:'🛍',name:'Portal B2B de pedidos',desc:'Tus clientes hacen pedidos directamente desde su portal personalizado.',status:'pronto',color:'#d97706'},
                  {icon:'📦',name:'MercadoLibre / eCommerce',desc:'Sincronizá stock con tu tienda online automáticamente.',status:'pronto',color:'#d97706'},
                  {icon:'📄',name:'API REST pública',desc:'Conectá cualquier sistema externo con la API documentada.',status:'próximamente',color:'#6366f1'},
                ].map(i=>(
                  <div key={i.name} style={{border:'1px solid #e2e2de',borderRadius:10,padding:'14px 16px',
                    display:'flex',alignItems:'center',gap:14}}>
                    <span style={{fontSize:24,flexShrink:0}}>{i.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,fontWeight:700,color:'#1a1a18'}}>{i.name}</div>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>{i.desc}</div>
                    </div>
                    <span style={{background:i.status==='disponible'?'#f0fdf4':i.status==='pronto'?'#fffbeb':'#eff6ff',
                      color:i.color,fontFamily:'DM Sans,Inter,sans-serif',fontSize:11,fontWeight:700,
                      padding:'4px 11px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                      {i.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

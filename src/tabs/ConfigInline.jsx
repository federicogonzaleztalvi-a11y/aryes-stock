import React, { useState, useEffect } from 'react';
import UsersTab from './UsersTab.jsx';
import RolesTab from './config/RolesTab.jsx';
import { db, getOrgId } from '../lib/constants.js';
import { T, Cap, Inp, Field } from '../lib/ui.jsx';

// ── Panel de dominio CNAME ───────────────────────────────────────────────
// ── Gestión de zonas del depósito ────────────────────────────────────────
function ZonasDeposito({ orgId }) {
  const [zonas, setZonas] = React.useState([]);
  const [editZona, setEditZona] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const SB = import.meta.env.VITE_SUPABASE_URL;
  const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/deposit_zones?org_id=eq.${orgId}&active=eq.true&order=orden.asc`,
        { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const data = await r.json();
      setZonas(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  }, [orgId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!editZona?.nombre?.trim()) return;
    setSaving(true);
    try {
      const body = { org_id: orgId, nombre: editZona.nombre, orden: editZona.orden || 0, descripcion: editZona.descripcion || '', categorias: editZona.categorias || [] };
      if (editZona.id) {
        await fetch(`${SB}/rest/v1/deposit_zones?id=eq.${editZona.id}`, { method:'PATCH', headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(body) });
      } else {
        await fetch(`${SB}/rest/v1/deposit_zones`, { method:'POST', headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(body) });
      }
      setEditZona(null); setMsg('Zona guardada'); setTimeout(()=>setMsg(''),3000); await cargar();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const eliminar = async (id) => {
    await fetch(`${SB}/rest/v1/deposit_zones?id=eq.${id}`, { method:'PATCH', headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify({active:false}) });
    await cargar();
  };

  return (
    <div style={{display:'grid',gap:20,maxWidth:640}}>
      <div>
        <h3 style={{fontSize:16,fontWeight:600,margin:'0 0 6px'}}>Zonas del depósito</h3>
        <p style={{fontSize:13,color:'#666',margin:0}}>Definí las zonas físicas del depósito y asignales categorías de productos. Esto permite ordenar el picking por recorrido óptimo.</p>
      </div>
      {msg && <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#166534',fontWeight:600}}>{msg}</div>}
      <div style={{display:'grid',gap:8}}>
        {zonas.map(z => (
          <div key={z.id} style={{display:'flex',alignItems:'center',gap:12,background:'#f9f9f7',border:'1px solid #e5e5e0',borderRadius:8,padding:'12px 14px'}}>
            <div style={{width:32,height:32,background:'#1a8a3c',color:'#fff',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{z.orden}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{z.nombre}</div>
              {z.descripcion && <div style={{fontSize:11,color:'#9a9a98'}}>{z.descripcion}</div>}
              {z.categorias?.length > 0 && <div style={{fontSize:11,color:'#1a8a3c',marginTop:2}}>{z.categorias.join(', ')}</div>}
            </div>
            <button onClick={()=>setEditZona({...z})} style={{background:'none',border:'1px solid #e5e5e0',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'#4a4a48'}}>Editar</button>
            <button onClick={()=>eliminar(z.id)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:16,padding:'0 4px'}}>×</button>
          </div>
        ))}
        <button onClick={()=>setEditZona({nombre:'',orden:zonas.length+1,descripcion:'',categorias:[]})}
          style={{background:'none',border:'1px dashed #d0d0cc',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer',color:'#6a6a68'}}>
          + Nueva zona
        </button>
      </div>
      {editZona && (
        <div style={{background:'#f9f9f7',border:'1px solid #e5e5e0',borderRadius:10,padding:18,display:'grid',gap:12}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{editZona.id ? 'Editar zona' : 'Nueva zona'}</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>Nombre</div>
              <input value={editZona.nombre} onChange={e=>setEditZona(z=>({...z,nombre:e.target.value}))}
                placeholder="Zona A" style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>Orden</div>
              <input type="number" value={editZona.orden} onChange={e=>setEditZona(z=>({...z,orden:+e.target.value}))}
                style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Descripción</div>
            <input value={editZona.descripcion||''} onChange={e=>setEditZona(z=>({...z,descripcion:e.target.value}))}
              placeholder="Ej: Sector refrigerados, fondo izquierda..." style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Categorías de productos (separadas por coma)</div>
            <input value={(editZona.categorias||[]).join(', ')} onChange={e=>setEditZona(z=>({...z,categorias:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))}
              placeholder="CHOCOLATES, PASTELERÍA, ADITIVOS..." style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={guardar} disabled={saving}
              style={{flex:1,background:'#1a8a3c',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>
              {saving?'Guardando...':'Guardar zona'}
            </button>
            <button onClick={()=>setEditZona(null)}
              style={{background:'#f0f0ec',color:'#4a4a48',border:'none',borderRadius:8,padding:'10px 16px',fontSize:13,cursor:'pointer'}}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DominioCNAMEPanel({ orgId }) {
  const [dominios, setDominios] = React.useState([]);
  const [nuevo, setNuevo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const SB = import.meta.env.VITE_SUPABASE_URL;
  const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/domain_orgs?org_id=eq.${orgId}&select=id,domain,active,created_at&order=created_at.desc`,
        { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const data = await r.json();
      setDominios(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  }, [orgId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setSaving(true);
    try {
      await fetch(`${SB}/rest/v1/domain_orgs`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ domain: nuevo.trim().toLowerCase(), org_id: orgId, active: true }),
      });
      setNuevo('');
      setMsg('Dominio registrado. Contactá a Aryes para activarlo en Vercel.');
      setTimeout(() => setMsg(''), 5000);
      await cargar();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{display:"grid",gap:12}}>
      {msg && <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#166534",fontWeight:600}}>{msg}</div>}
      <div>
        <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>Tus dominios registrados</div>
        {dominios.length === 0 ? (
          <div style={{fontSize:13,color:"#9a9a98",fontStyle:"italic"}}>Ningún dominio registrado todavía.</div>
        ) : (
          <div style={{display:"grid",gap:6}}>
            {dominios.map(d => (
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f9f9f7",border:"1px solid #e5e5e0",borderRadius:8,padding:"10px 14px"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a1a18",fontFamily:"monospace"}}>{d.domain}</div>
                  <div style={{fontSize:11,color:"#9a9a98",marginTop:2}}>{d.active ? "✓ Activo" : "⏳ Pendiente activación"}</div>
                </div>
                <span style={{fontSize:11,background:d.active?"#d1fae5":"#fef3c7",color:d.active?"#065f46":"#92400e",borderRadius:20,padding:"2px 10px",fontWeight:600}}>
                  {d.active ? "Activo" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          placeholder="pedidos.tuempresa.com"
          style={{flex:1,border:"1px solid #e5e5e0",borderRadius:8,padding:"10px 14px",fontSize:13,fontFamily:"monospace",outline:"none"}}
          onKeyDown={e => e.key === 'Enter' && agregar()}
        />
        <button
          onClick={agregar}
          disabled={saving || !nuevo.trim()}
          style={{background:"#1a8a3c",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:saving?"default":"pointer",opacity:saving?0.6:1}}>
          {saving ? "Guardando..." : "Registrar"}
        </button>
      </div>
    </div>
  );
}

// Role-based access
import { useRole } from '../hooks/useRole.ts';

export default function ConfigInline({
  session,
  suppliers, setSuppliers,
  settingsTab, setSettingsTab,
  emailCfg, setEmailCfg,
  enriched, sendAlertEmail, EmailSettings,
  totalLead, tfCols,
  brandCfg={}, setBrandCfg
}) {
  const { isAdmin } = useRole();
  // ── Brand config state — top level, no IIFE ──────────────────────────────
  const [localBrand, setLocalBrand] = useState({
    name:       brandCfg.name       || '',
    logoUrl:    brandCfg.logoUrl    || '',
    color:      brandCfg.color      || '#1a8a3c',
    ownerPhone: brandCfg.ownerPhone || '',
    rut:        brandCfg.rut        || '',
    direccion:  brandCfg.direccion  || '',
    email:      brandCfg.email      || '',
    web:        brandCfg.web        || '',
  });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved,  setBrandSaved]  = useState(false);

  // Sync localBrand when parent brandCfg changes (e.g. after initial DB load)
  useEffect(() => {
    setLocalBrand({
      name:       brandCfg.name       || '',
      logoUrl:    brandCfg.logoUrl    || '',
      color:      brandCfg.color      || '#1a8a3c',
      ownerPhone: brandCfg.ownerPhone || '',
      rut:        brandCfg.rut        || '',
      direccion:  brandCfg.direccion  || '',
      email:      brandCfg.email      || '',
      web:        brandCfg.web        || '',
    });
  }, [brandCfg.name, brandCfg.logoUrl, brandCfg.color, brandCfg.rut]);

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
          <div style={{display:"flex",gap:8,borderRadius:6,overflowX:"auto",marginBottom:24,scrollbarWidth:"none"}}>
            {[{id:"usuarios",l:"Usuarios"},{id:"roles",l:"Roles"},{id:"marca",l:"Marca"},{id:"facturacion_cfg",l:"Facturación DGI"},{id:"freight",l:"Flete"},{id:"email",l:"Emails"},{id:"integraciones",l:"Integraciones"},{id:"dominio",l:"Dominio"},{id:"zonas",l:"Zonas depósito"},{id:"portal",l:"Portal B2B"}].map(st=>(
              <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                style={{flex:"0 0 auto",padding:"10px 16px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.sans,fontSize:12,fontWeight:600,
                  background:settingsTab===st.id?T.green:"#fff",color:settingsTab===st.id?"#fff":T.textSm,borderRadius:6,border:settingsTab===st.id?"none":"1px solid "+T.border}}>
                {st.l}
              </button>
            ))}
          </div>

          {/* ── USUARIOS ─────────────────────────────────────────────────── */}
          {settingsTab==="usuarios" && (
            <UsersTab session={session} />
          )}

          {settingsTab==="roles" && (
            <RolesTab session={session} />
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
                      value={localBrand.color||'#1a8a3c'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{width:48,height:36,padding:2,border:'1px solid #e2e2de',borderRadius:6,cursor:'pointer'}}
                    />
                    <input
                      value={localBrand.color||'#1a8a3c'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{...inp2,width:120}}
                    />
                    <div style={{padding:'6px 14px',borderRadius:6,background:localBrand.color||'#1a8a3c',color:'#fff',fontSize:12,fontWeight:600}}>
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

                {/* Datos fiscales para documentos */}
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#166534',marginBottom:12}}>
                    📄 Datos para remitos y facturas
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>RUT de la empresa</label>
                      <input
                        value={localBrand.rut||''}
                        onChange={e=>setLocalBrand(b=>({...b,rut:e.target.value}))}
                        placeholder='Ej: 21234567890'
                        style={inp2}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Email de la empresa</label>
                      <input
                        value={localBrand.email||''}
                        onChange={e=>setLocalBrand(b=>({...b,email:e.target.value}))}
                        placeholder='contacto@empresa.com'
                        style={inp2}
                      />
                    </div>
                    <div style={{gridColumn:'1/-1'}}>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Dirección</label>
                      <input
                        value={localBrand.direccion||''}
                        onChange={e=>setLocalBrand(b=>({...b,direccion:e.target.value}))}
                        placeholder='Ej: Av. 18 de Julio 1234, Montevideo'
                        style={inp2}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Sitio web</label>
                      <input
                        value={localBrand.web||''}
                        onChange={e=>setLocalBrand(b=>({...b,web:e.target.value}))}
                        placeholder='www.empresa.com'
                        style={inp2}
                      />
                    </div>
                  </div>
                </div>

                <div style={{paddingTop:8,borderTop:'1px solid #e2e2de',display:'flex',alignItems:'center',gap:12}}>
                  
              {/* ── Impuesto sobre ventas (multi-país) ────────────────────── */}
              {(()=>{
                const TAX_PRESETS={
                  UY:{name:'IVA',rates:[{v:22,l:'22% (Básica)'},{v:10,l:'10% (Mínima)'},{v:0,l:'0% (Exento)'}],default:22},
                  AR:{name:'IVA',rates:[{v:21,l:'21% (General)'},{v:10.5,l:'10.5% (Reducida)'},{v:27,l:'27% (Servicios)'},{v:0,l:'0% (Exento)'}],default:21},
                  CL:{name:'IVA',rates:[{v:19,l:'19% (General)'},{v:0,l:'0% (Exento)'}],default:19},
                  CO:{name:'IVA',rates:[{v:19,l:'19% (General)'},{v:5,l:'5% (Reducida)'},{v:0,l:'0% (Exento)'}],default:19},
                  PE:{name:'IGV',rates:[{v:18,l:'18% (General)'},{v:0,l:'0% (Exento)'}],default:18},
                  MX:{name:'IVA',rates:[{v:16,l:'16% (General)'},{v:0,l:'0% (Exento)'}],default:16},
                  BR:{name:'ICMS',rates:[{v:18,l:'18% (SP)'},{v:20,l:'20% (RJ)'},{v:17,l:'17% (Otros)'},{v:0,l:'0% (Exento)'}],default:18},
                  PY:{name:'IVA',rates:[{v:10,l:'10% (General)'},{v:5,l:'5% (Reducida)'},{v:0,l:'0% (Exento)'}],default:10},
                  EC:{name:'IVA',rates:[{v:15,l:'15% (General)'},{v:0,l:'0% (Exento)'}],default:15},
                  ES:{name:'IVA',rates:[{v:21,l:'21% (General)'},{v:10,l:'10% (Reducido)'},{v:4,l:'4% (Super reducido)'},{v:0,l:'0% (Exento)'}],default:21},
                  US:{name:'Sales Tax',rates:[{v:0,l:'0%'},{v:6,l:'6%'},{v:7,l:'7%'},{v:8.25,l:'8.25%'},{v:10,l:'10%'}],default:0},
                  OTHER:{name:'Impuesto',rates:[{v:0,l:'0%'},{v:5,l:'5%'},{v:10,l:'10%'},{v:15,l:'15%'},{v:20,l:'20%'},{v:22,l:'22%'}],default:0},
                };
                const country=brandCfg.tax_country||'UY';
                const preset=TAX_PRESETS[country]||TAX_PRESETS.OTHER;
                const taxName=brandCfg.tax_name||preset.name;
                const taxRate=brandCfg.iva_default!=null?brandCfg.iva_default:preset.default;
                const isCustomRate=!preset.rates.some(r=>r.v===taxRate);
                return (
                  <div style={{marginTop:16,background:"#f9f9f7",borderRadius:10,padding:14,border:"1px solid #e2e2de"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1a1a18",marginBottom:10}}>Impuesto sobre ventas</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>País</label>
                        <select value={country} onChange={e=>{const c=e.target.value;const p=TAX_PRESETS[c]||TAX_PRESETS.OTHER;setBrandCfg(prev=>({...prev,tax_country:c,tax_name:p.name,iva_default:p.default}));}}
                          style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}}>
                          <option value="UY">🇺🇾 Uruguay</option>
                          <option value="AR">🇦🇷 Argentina</option>
                          <option value="CL">🇨🇱 Chile</option>
                          <option value="CO">🇨🇴 Colombia</option>
                          <option value="PE">🇵🇪 Perú</option>
                          <option value="MX">🇲🇽 México</option>
                          <option value="BR">🇧🇷 Brasil</option>
                          <option value="PY">🇵🇾 Paraguay</option>
                          <option value="EC">🇪🇨 Ecuador</option>
                          <option value="ES">🇪🇸 España</option>
                          <option value="US">🇺🇸 Estados Unidos</option>
                          <option value="OTHER">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>Nombre del impuesto</label>
                        <input value={taxName} onChange={e=>setBrandCfg(p=>({...p,tax_name:e.target.value}))}
                          style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}} placeholder="IVA, IGV, Sales Tax..."/>
                      </div>
                    </div>
                    <div style={{marginTop:10}}>
                      <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>Tasa por defecto</label>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <select value={isCustomRate?'custom':taxRate} onChange={e=>{const v=e.target.value;if(v!=='custom')setBrandCfg(p=>({...p,iva_default:+v}));}}
                          style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}}>
                          {preset.rates.map(r=><option key={r.v} value={r.v}>{taxName} {r.l}</option>)}
                          <option value="custom">Personalizado</option>
                        </select>
                        {isCustomRate&&<input type="number" min={0} max={99} step={0.5} value={taxRate} onChange={e=>setBrandCfg(p=>({...p,iva_default:+e.target.value}))}
                          style={{width:70,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff",textAlign:"center"}}/>}
                        {isCustomRate&&<span style={{fontSize:11,color:"#6a6a68"}}>%</span>}
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#9a9a98",marginTop:6}}>Se usa como valor por defecto al crear productos. Cada producto puede tener su propia tasa.</div>
                  </div>
                );
              })()}
              <button onClick={saveBrand} disabled={brandSaving}
                    style={{padding:'9px 24px',background:brandSaving?'#9ca3af':(localBrand.color||'#1a8a3c'),color:'#fff',border:'none',borderRadius:8,cursor:brandSaving?'not-allowed':'pointer',fontWeight:600,fontSize:13}}>
                    {brandSaving?'Guardando…':'Guardar marca'}
                  </button>
                  {brandSaved && <span style={{color:'#1a8a3c',fontSize:13,fontWeight:600}}>✓ Guardado</span>}
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
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#1a8a3c'}
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
                  ¿Tenés contrato con otro proveedor habilitado por DGI? <span style={{color:'#1a8a3c',fontWeight:600,cursor:'pointer'}}>Contactanos →</span>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRACIONES ─────────────────────────────────────────────── */}
          {settingsTab==="zonas" && (
            <ZonasDeposito orgId={brandCfg?.orgId || 'aryes'} />
          )}
          {settingsTab==="portal" && (
            <div style={{maxWidth:560}}>
              <h3 style={{fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:600,margin:'0 0 6px'}}>Portal B2B</h3>
              <p style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#666',margin:'0 0 20px',lineHeight:1.6}}>
                Configurá el portal que ven tus clientes. Podés habilitar un catálogo de consulta o un portal completo con carrito de pedidos.
              </p>

              <div style={{display:'grid',gap:16}}>
                {/* Toggle: Catálogo público */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Catálogo público</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Tus clientes ven productos y precios sin hacer pedidos</div>
                  </div>
                  <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:'pointer'}}>
                    <input type="checkbox" checked={brandCfg?.portalCatalogo!==false} onChange={e=>{
                      const updated = {...(brandCfg||{}), portalCatalogo: e.target.checked};
                      setBrandCfg(updated);
                      db.upsert('app_config', {key:'brandcfg',value:updated,org_id:getOrgId()}, 'key,org_id');
                    }} style={{opacity:0,width:0,height:0}} />
                    <span style={{position:'absolute',inset:0,background:brandCfg?.portalCatalogo!==false?'#1a8a3c':'#ccc',borderRadius:12,transition:'.2s'}} />
                    <span style={{position:'absolute',top:2,left:brandCfg?.portalCatalogo!==false?22:2,width:20,height:20,background:'#fff',borderRadius:10,transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}} />
                  </label>
                </div>

                {/* Toggle: Portal de pedidos */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Portal de pedidos (carrito)</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Tus clientes pueden armar pedidos y enviarlos por WhatsApp</div>
                  </div>
                  <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:'pointer'}}>
                    <input type="checkbox" checked={brandCfg?.portalPedidos!==false} onChange={e=>{
                      const updated = {...(brandCfg||{}), portalPedidos: e.target.checked};
                      setBrandCfg(updated);
                      db.upsert('app_config', {key:'brandcfg',value:updated,org_id:getOrgId()}, 'key,org_id');
                    }} style={{opacity:0,width:0,height:0}} />
                    <span style={{position:'absolute',inset:0,background:brandCfg?.portalPedidos!==false?'#1a8a3c':'#ccc',borderRadius:12,transition:'.2s'}} />
                    <span style={{position:'absolute',top:2,left:brandCfg?.portalPedidos!==false?22:2,width:20,height:20,background:'#fff',borderRadius:10,transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}} />
                  </label>
                </div>

                {/* URL del portal */}
                <div style={{background:'#f7f6f3',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px'}}>
                  <div style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:'#1a1a18',marginBottom:8}}>URL de tu portal</div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <code style={{flex:1,fontFamily:'monospace',fontSize:12,color:'#1a8a3c',background:'#fff',padding:'8px 12px',borderRadius:6,border:'1px solid #e8e4de',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {window.location.origin}/catalogo?org={brandCfg?.orgId||getOrgId()}
                    </code>
                    <button onClick={()=>{
                      const url=window.location.origin+'/catalogo?org='+(brandCfg?.orgId||getOrgId());
                      navigator.clipboard?.writeText(url);
                      alert('URL copiada al portapapeles');
                    }} style={{padding:'8px 14px',background:'#1a8a3c',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                      Copiar
                    </button>
                  </div>
                  <div style={{fontFamily:'Inter,sans-serif',fontSize:11,color:'#9a9a98',marginTop:8}}>Compartí este link con tus clientes por WhatsApp o email</div>
                </div>
              </div>
            </div>
          )}
          {settingsTab==="dominio" && (
            <div style={{display:"grid",gap:20,maxWidth:600}}>
              <div>
                <h3 style={{fontSize:16,fontWeight:600,margin:"0 0 6px"}}>Dominio personalizado</h3>
                <p style={{fontSize:13,color:"#666",margin:0}}>
                  Configurá un dominio propio para tu portal B2B. Tus clientes accederán desde <strong>pedidos.tuempresa.com</strong> en vez de aryes-stock.vercel.app.
                </p>
              </div>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#166534",marginBottom:8}}>Cómo configurarlo</div>
                <div style={{fontSize:12,color:"#166534",display:"grid",gap:6}}>
                  <div>1. En tu proveedor de DNS, creá un registro <strong>CNAME</strong></div>
                  <div style={{fontFamily:"monospace",background:"#dcfce7",padding:"6px 10px",borderRadius:4,fontSize:11}}>
                    pedidos.tuempresa.com → cname.vercel-dns.com
                  </div>
                  <div>2. Registrá el dominio acá abajo</div>
                  <div>3. Contactá a Aryes para activarlo en Vercel (tarda ~5 minutos)</div>
                </div>
              </div>
              <DominioCNAMEPanel orgId={brandCfg?.orgId || 'aryes'} />
            </div>
          )}
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

import { useState, useEffect } from 'react';
import { LS, db } from '../lib/constants.js';

function ConfigTab(){
  const G="#3a7d1e";
  const [emailCfg,setEmailCfg]=useState({serviceId:'',templateId:'',publicKey:'',toEmail:'',enabled:false});
  const [cfgLoading,setCfgLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      try{
        const rows=await db.get('app_config?key=eq.emailcfg');
        if(rows?.[0]?.value) setEmailCfg(rows[0].value);
        LS.remove('aryes9-emailcfg');
      }catch(e){}
      setCfgLoading(false);
    })();
  },[]);
  const [waTpl,setWaTpl]=useState(()=>localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos! - Aryes');
  const [stockMin,setStockMin]=useState(()=>localStorage.getItem('aryes-stock-min-default')||'5');
  const [empresa,setEmpresa]=useState(()=>localStorage.getItem('aryes-empresa')||'Aryes');
  const [msg,setMsg]=useState('');
  const inp={padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};

  const save=async ()=>{
    try{ await db.upsert('app_config',[{key:'emailcfg',value:emailCfg,updated_at:new Date().toISOString()}]); LS.remove('aryes9-emailcfg'); }catch(e){ console.warn('[Aryes] emailcfg save err',e); }
    localStorage.setItem('aryes-wa-template',waTpl);
    localStorage.setItem('aryes-stock-min-default',stockMin);
    localStorage.setItem('aryes-empresa',empresa);
    setMsg('Configuracion guardada');
    setTimeout(()=>setMsg(''),3000);
  };

  return(
    <section style={{padding:'28px 36px',maxWidth:800,margin:'0 auto'}}>
      <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:'0 0 4px'}}>Configuracion</h2>
      <p style={{fontSize:12,color:'#888',margin:'0 0 24px'}}>Ajustes generales del sistema</p>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {/* General */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 16px'}}>General</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Nombre de la empresa</label>
            <input style={inp} value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Aryes" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Stock minimo por defecto</label>
            <input type="number" style={inp} value={stockMin} onChange={e=>setStockMin(e.target.value)} min="0" />
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 6px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#25d366'}}>📩</span> Plantilla WhatsApp
        </h3>
        <p style={{fontSize:12,color:'#888',margin:'0 0 12px'}}>Variables: <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>{'{cliente}'}</code> nombre del cliente · <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>{'{detalle}'}</code> detalle de la entrega</p>
        <textarea value={waTpl} onChange={e=>setWaTpl(e.target.value)} rows={3} style={{...inp,resize:'vertical'}} />
        <div style={{fontSize:11,color:'#888',marginTop:6}}>Vista previa: <em>{waTpl.replace('{cliente}','Panaderia Lopez').replace('{detalle}','su pedido V-0001 fue entregado hoy')}</em></div>
      </div>

      {/* Email */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 16px'}}>📧 Alertas por Email (EmailJS)</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {[
            {l:'Service ID',k:'serviceId',ph:'service_xxx'},
            {l:'Template ID',k:'templateId',ph:'template_xxx'},
            {l:'Public Key',k:'publicKey',ph:'AbCdEf...'},
            {l:'Email destino',k:'toEmail',ph:'admin@aryes.com.uy'},
          ].map(f=>(
            <div key={f.k}>
              <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
              <input style={inp} value={emailCfg[f.k]||''} onChange={e=>setEmailCfg(c=>({...c,[f.k]:e.target.value}))} placeholder={f.ph} />
            </div>
          ))}
        </div>
      </div>

      {/* Accesos */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 12px'}}>🔒 Usuarios del sistema</h3>
        <div style={{display:'grid',gap:8}}>
          {[
            {rol:'admin',user:'admin',pass:'aryes2024',color:'#3a7d1e'},
            {rol:'operador',user:'operador',pass:'stock123',color:'#3b82f6'},
            {rol:'vendedor',user:'vendedor',pass:'ventas123',color:'#8b5cf6'},
          ].map(u=>(
            <div key={u.rol} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#f9fafb',borderRadius:8}}>
              <span style={{background:u.color,color:'#fff',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20}}>{u.rol}</span>
              <span style={{fontSize:13,color:'#374151'}}>Usuario: <strong>{u.user}</strong></span>
              <span style={{fontSize:13,color:'#374151'}}>Contrasena: <strong>{u.pass}</strong></span>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:'#aaa',marginTop:8}}>Para cambiar credenciales editar el codigo fuente en AryesApp USERS array.</p>
      </div>

      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <button onClick={save} style={{padding:'10px 28px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>Guardar configuracion</button>
      </div>
    </section>
  );
}

export default ConfigTab;

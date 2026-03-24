/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { LS } from '../../lib/constants.js';

// ── Email Alerts via EmailJS ─────────────────────────────────────────────
const sendLowStockAlert = async (product, currentStock) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: product.name,
          brand: product.brand || '',
          current_stock: currentStock,
          min_stock: product.minStock || 5,
          unit: product.unit || '',
          date: new Date().toLocaleDateString('es-UY'),
        }
      })
    });
  } catch(e) { console.warn('Email alert failed:', e); }
};

const sendDailyAlertSummary = async (lowStockProducts) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  if (lowStockProducts.length === 0) return;
  const productList = lowStockProducts.map(p =>
    p.name + ' (stock: ' + (p.stock||0) + ' ' + (p.unit||'') + ', mín: ' + (p.minStock||5) + ')'
  ).join(', ');
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: lowStockProducts.length + ' productos bajo stock mínimo',
          brand: 'Resumen diario de stock',
          current_stock: lowStockProducts.length,
          min_stock: 0,
          unit: 'productos',
          date: new Date().toLocaleDateString('es-UY'),
          extra: productList,
        }
      })
    });
  } catch(e) { console.warn('Daily summary failed:', e); }
};

// ── Email Config Tab ─────────────────────────────────────────────────────
 
const EmailConfigTab=({products,session})=>{
  const [cfg,setCfg]=useState(()=>LS.get('aryes-email-config',{serviceId:'',templateId:'',publicKey:'',toEmail:''}));
  const [msg,setMsg]=useState('');
  const [testing,setTesting]=useState(false);
  const canEdit=session.role==='admin';

  const save=()=>{
    LS.set('aryes-email-config',cfg);
    setMsg('Configuración guardada ✓');
    setTimeout(()=>setMsg(''),2500);
  };

  const test=async()=>{
    if(!cfg.serviceId||!cfg.templateId||!cfg.publicKey||!cfg.toEmail){setMsg('Completá todos los campos primero');return;}
    setTesting(true);
    const testProd={name:'Chocolate Cobertura Leche 1kg (TEST)',brand:'Selecta',stock:2,minStock:10,unit:'kg'};
    await sendLowStockAlert(testProd,2);
    setTesting(false);
    setMsg('Email de prueba enviado a '+cfg.toEmail+' ✓');
    setTimeout(()=>setMsg(''),4000);
  };

  const lowCount=products.filter(p=>(p.stock||0)<(p.minStock||5)).length;

  const sendSummary=async()=>{
    const low=products.filter(p=>(p.stock||0)<(p.minStock||5));
    await sendDailyAlertSummary(low);
    setMsg('Resumen enviado con '+low.length+' productos ✓');
    setTimeout(()=>setMsg(''),3000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:680}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Notificaciones</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Alertas por Email</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Recibí un email automático cuando el stock cae por debajo del mínimo.</p>
      </div>

      {/* Status summary */}
      <div style={{background:lowCount>0?'#fef2f2':'#f0f7ec',border:'1px solid '+(lowCount>0?'#fecaca':'#b8d9a8'),borderRadius:12,padding:'16px 20px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>{lowCount>0?'🚨':'✅'}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:lowCount>0?'#dc2626':'#16a34a'}}>
              {lowCount>0?lowCount+' productos bajo stock mínimo':'Todos los productos con stock suficiente'}
            </div>
            <div style={{fontSize:12,color:'#9a9a98'}}>Revisado ahora</div>
          </div>
        </div>
        {lowCount>0&&canEdit&&<button onClick={sendSummary}
          style={{padding:'8px 16px',background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Enviar resumen ahora
        </button>}
      </div>

      {/* Setup guide */}
      <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'16px 20px',marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:'#3a7d1e',marginBottom:8}}>Cómo configurar (gratis con EmailJS):</div>
        <ol style={{fontSize:12,color:'#5a7a4a',margin:0,paddingLeft:20,lineHeight:1.8}}>
          <li>Entrá a <strong>emailjs.com</strong> y creá una cuenta gratuita</li>
          <li>En "Email Services" conectá tu Gmail o email de la empresa</li>
          <li>En "Email Templates" creá una plantilla — usá estas variables: <code style={{background:'#fff',padding:'1px 4px',borderRadius:3}}>{'{{product_name}} {{current_stock}} {{min_stock}} {{unit}} {{date}}'}</code></li>
          <li>Copiá tu Service ID, Template ID y Public Key abajo</li>
        </ol>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {canEdit?(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {[
              {label:'Email destino',key:'toEmail',ph:'alertas@empresa.com',type:'email'},
              {label:'Service ID (EmailJS)',key:'serviceId',ph:'service_xxxxxxx',type:'text'},
              {label:'Template ID (EmailJS)',key:'templateId',ph:'template_xxxxxxx',type:'text'},
              {label:'Public Key (EmailJS)',key:'publicKey',ph:'xxxxxxxxxxxxxxxxxxxxxx',type:'text'},
            ].map(({label,key,ph,type})=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>{label}</label>
                <input type={type} value={cfg[key]||''} onChange={e=>setCfg(c=>({...c,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button onClick={save} style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
              <button onClick={test} disabled={testing} style={{padding:'10px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit',opacity:testing?.6:1}}>
                {testing?'Enviando...':'Enviar email de prueba'}
              </button>
            </div>
          </div>
        </div>
      ):<div style={{padding:'20px',background:'#f9f9f7',borderRadius:10,color:'#9a9a98',fontSize:13}}>Solo el administrador puede configurar las alertas.</div>}
    </div>
  );
};

export { sendLowStockAlert, sendDailyAlertSummary, EmailConfigTab };

import React, { useState } from 'react';
import { T, Inp, Field, Btn, Cap } from '../lib/ui.jsx';

const EmailSettings = ({ cfg, setCfg, enriched, onTestSend: _onTestSend, onManualSend }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const set = (k,v) => setCfg(c=>({...c,[k]:v}));
  const configured = cfg.serviceId && cfg.templateId && cfg.publicKey && cfg.toEmail;

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey,
          template_params: { to_email: cfg.toEmail, subject:"✓ Email de prueba funcionando", html_content:"<p style='font-family:sans-serif;padding:20px;'>✅ Las notificaciones están configuradas correctamente. Recibirás alertas automáticas cuando el stock cruce el punto de pedido.</p>", alert_count:0 }
        })
      });
      setTestResult(resp.status===200?"ok":"error");
    } catch { setTestResult("error"); }
    setTesting(false);
  };

  const alertProds = enriched.filter(p=>p.alert.level==="order_now"||p.alert.level==="order_soon");

  return (
    <div style={{display:"grid",gap:20,maxWidth:680}}>
      {/* Status banner */}
      <div style={{background:cfg.enabled&&configured?T.okBg:T.warnBg, border:`1px solid ${cfg.enabled&&configured?T.okBd:T.warnBd}`, borderRadius:8, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:cfg.enabled&&configured?T.ok:T.warning}}>
            {cfg.enabled&&configured ? "✓ Notificaciones activas" : configured ? "Notificaciones desactivadas" : "⚠ Pendiente de configuración"}
          </div>
          <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:3}}>
            {cfg.enabled&&configured ? `Enviando alertas a ${cfg.toEmail}` : !configured ? "Completá los datos de EmailJS para activar" : "Activá el switch para empezar a recibir alertas"}
          </p>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{cfg.enabled?"ON":"OFF"}</span>
          <div onClick={()=>set("enabled",!cfg.enabled)}
            style={{width:44,height:24,borderRadius:12,background:cfg.enabled?T.green:T.border,position:"relative",cursor:"pointer",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:cfg.enabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>

      {/* How to setup guide */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}>
          <Cap>Cómo configurar EmailJS (gratis — 200 emails/mes)</Cap>
        </div>
        <div style={{padding:"16px 18px",display:"grid",gap:10}}>
          {[
            {n:1, t:"Creá cuenta gratis", d:<>Entrá a <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{color:T.green,fontWeight:600}}>emailjs.com</a> → Sign Up gratis</>, },
            {n:2, t:"Conectá tu email",   d:"En el panel → Email Services → Add New Service → elegí Gmail, Outlook o el que uses → conectá tu cuenta"},
            {n:3, t:"Creá un template",   d:'En Email Templates → Create New → en el cuerpo del email escribí exactamente: {{{html_content}}} — así el sistema puede enviar el HTML del reporte'},
            {n:4, t:"Copiá las claves",   d:"Service ID (en Email Services), Template ID (en Email Templates), Public Key (en Account → API Keys)"},
            {n:5, t:"Pegá las claves abajo y activá", d:"Completá los 4 campos, activá el switch de arriba, y hacé click en 'Enviar email de prueba'"},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:T.green,color:"#fff",fontFamily:T.sans,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.n}</div>
              <div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{s.t}</div>
                <div style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:2,lineHeight:1.5}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config fields */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Configuración EmailJS</Cap></div>
        <div style={{padding:"16px 18px",display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Service ID" hint="Ej: service_abc123">
              <Inp value={cfg.serviceId} onChange={e=>set("serviceId",e.target.value)} placeholder="service_xxxxxxx"/>
            </Field>
            <Field label="Template ID" hint="Ej: template_abc123">
              <Inp value={cfg.templateId} onChange={e=>set("templateId",e.target.value)} placeholder="template_xxxxxxx"/>
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Public Key" hint="En Account → API Keys">
              <Inp value={cfg.publicKey} onChange={e=>set("publicKey",e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxx"/>
            </Field>
            <Field label="Email de destino" hint="Donde querés recibir las alertas">
              <Inp type="email" value={cfg.toEmail} onChange={e=>set("toEmail",e.target.value)} placeholder="tu@email.com"/>
            </Field>
          </div>
        </div>
      </div>

      {/* Test + manual send */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <Btn onClick={handleTest} full disabled={!configured||testing} variant="ghost">
            {testing ? "Enviando..." : "✉ Enviar email de prueba"}
          </Btn>
          {testResult==="ok" && <p style={{fontFamily:T.sans,fontSize:12,color:T.ok,marginTop:6,textAlign:"center"}}>✓ Email enviado correctamente</p>}
          {testResult==="error" && <p style={{fontFamily:T.sans,fontSize:12,color:T.danger,marginTop:6,textAlign:"center"}}>✗ Error — verificá las claves</p>}
        </div>
        <div>
          <Btn onClick={()=>onManualSend(alertProds)} full disabled={!configured||!alertProds.length}>
            📋 Enviar resumen ahora ({alertProds.length} alertas)
          </Btn>
          {!alertProds.length && <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:6,textAlign:"center"}}>Sin alertas activas ahora mismo</p>}
        </div>
      </div>

      {/* Alert behavior info */}
      <div style={{background:T.cardWarm,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 18px"}}>
        <Cap>Comportamiento de las alertas automáticas</Cap>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {[
            {icon:"🔴", t:"Pedir YA",     d:"Email inmediato cuando el stock cae por debajo del punto de pedido (ROP)"},
            {icon:"🟡", t:"Pedir pronto", d:"Email inmediato cuando quedan ≤5 días para cruzar el ROP"},
            {icon:"🔄", t:"Sin repetición", d:"No manda el mismo email dos veces para el mismo producto — espera hasta que el stock cambie"},
            {icon:"📋", t:"Resumen manual", d:"Podés pedir el resumen de todas las alertas activas en cualquier momento con el botón de arriba"},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
              <div>
                <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.t} — </span>
                <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER TAB — Catálogo Lovable (249 productos)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return {hasError:true,error};}
  componentDidCatch(error,info){console.error('[Stock] ErrorBoundary caught:',error,info);}
  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:'24px',fontFamily:'Inter,sans-serif',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,margin:16}}>
          <p style={{color:'#dc2626',fontWeight:600,marginBottom:8}}>Error al cargar este módulo</p>
          <p style={{color:'#7a7368',fontSize:12,marginBottom:12}}>{String(this.state.error?.message||'Error desconocido')}</p>
          <button onClick={()=>this.setState({hasError:false,error:null})} style={{background:'#dc2626',color:'#fff',border:'none',padding:'8px 16px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:600}}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN

export default EmailSettings;

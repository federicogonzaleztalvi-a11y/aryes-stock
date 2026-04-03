// LandingPage.jsx — Public landing with features + pricing + CTA
import { useState } from 'react';

const G = '#1a8a3c';
const F = { sans: "'Inter',system-ui,sans-serif", serif: "'Playfair Display',serif" };

export default function LandingPage() {
  const [showRegister, setShowRegister] = useState(false);

  const features = [
    { icon: '📦', title: 'Inventario inteligente', desc: 'Control de stock en tiempo real con alertas de reposición y punto de reorden automático' },
    { icon: '🚚', title: 'Rutas y logística', desc: 'Optimización de rutas, GPS live, ETA por parada, firma digital y foto de entrega' },
    { icon: '🛒', title: 'Portal B2B', desc: 'Tus clientes hacen pedidos desde WhatsApp con login OTP. Auto-import a tu sistema' },
    { icon: '📊', title: 'Dashboard operativo', desc: 'KPIs en tiempo real, demand sensing, aging de deuda, clientes a contactar' },
    { icon: '💰', title: 'Facturación y cobros', desc: 'Cuenta corriente, cobranza en ruta, límite de crédito, historial completo' },
    { icon: '📱', title: 'Mobile-first', desc: 'Vista conductor, tracking público, push notifications. Funciona en cualquier dispositivo' },
  ];

  const comparisons = [
    { feature: 'Inventario + WMS', aryes: true, simpli: false, wis: true },
    { feature: 'Rutas + TMS', aryes: true, simpli: true, wis: false },
    { feature: 'Portal B2B integrado', aryes: true, simpli: false, wis: false },
    { feature: 'Self-service (sin implementación)', aryes: true, simpli: true, wis: false },
    { feature: 'GPS live + ETA', aryes: true, simpli: true, wis: false },
    { feature: 'Firma digital + foto entrega', aryes: true, simpli: false, wis: true },
    { feature: 'Precio mensual', aryes: '$299', simpli: '$40/veh', wis: '$500+' },
    { feature: 'Costo implementación', aryes: '$0', simpli: '$0', wis: '$10K-50K' },
  ];

  if (showRegister) {
    return (
      <div style={{minHeight:'100vh',background:'#f5f5f7',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:F.sans}}>
        <div style={{background:'#fff',borderRadius:16,padding:40,maxWidth:480,width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,.08)'}}>
          <button onClick={()=>setShowRegister(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'#6b7280',marginBottom:16}}>← Volver</button>
          <h2 style={{fontFamily:F.serif,fontSize:28,marginBottom:8,color:'#1a1a1a'}}>Crear cuenta</h2>
          <p style={{fontSize:14,color:'#6b7280',marginBottom:24}}>Empezá gratis. Sin tarjeta de crédito.</p>
          <iframe src="/register" style={{width:'100%',height:400,border:'none',borderRadius:8}} title="Registro"/>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f5f7',fontFamily:F.sans}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#1a1a18 0%,#2d2d2a 100%)',color:'#fff',padding:'80px 20px 60px',textAlign:'center'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{fontSize:13,fontWeight:600,color:G,marginBottom:12,letterSpacing:1}}>PLATAFORMA PARA DISTRIBUIDORAS</div>
          <h1 style={{fontFamily:F.serif,fontSize:'clamp(32px,5vw,52px)',fontWeight:500,lineHeight:1.15,marginBottom:16}}>
            Inventario, ventas, rutas y portal B2B en un solo lugar
          </h1>
          <p style={{fontSize:18,color:'#a8a8a6',maxWidth:600,margin:'0 auto 32px',lineHeight:1.6}}>
            La plataforma que usan las distribuidoras modernas de LATAM para operar sin planillas Excel ni sistemas de $50.000
          </p>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <button onClick={()=>window.location.href='/'}
              style={{padding:'14px 32px',background:G,color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>
              Explorar la plataforma
            </button>
            <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Aryes%20Stock" target="_blank" rel="noreferrer"
              style={{padding:'14px 32px',background:'transparent',color:'#fff',border:'1px solid rgba(255,255,255,.3)',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer',textDecoration:'none'}}>
              Hablar con ventas
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{maxWidth:1000,margin:'0 auto',padding:'60px 20px'}}>
        <h2 style={{fontFamily:F.serif,fontSize:32,textAlign:'center',marginBottom:40,color:'#1a1a1a'}}>Todo lo que necesitás</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:20}}>
          {features.map(f=>(
            <div key={f.title} style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <div style={{fontSize:32,marginBottom:12}}>{f.icon}</div>
              <h3 style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:6}}>{f.title}</h3>
              <p style={{fontSize:13,color:'#6b7280',lineHeight:1.5}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{background:'#fff',padding:'60px 20px'}}>
        <div style={{maxWidth:500,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontFamily:F.serif,fontSize:32,marginBottom:8,color:'#1a1a1a'}}>Un solo plan, todo incluido</h2>
          <p style={{fontSize:14,color:'#6b7280',marginBottom:32}}>Sin sorpresas, sin costo de implementación, sin contratos</p>
          <div style={{background:'#f5f5f7',borderRadius:16,padding:40,border:'2px solid '+G}}>
            <div style={{fontSize:48,fontWeight:800,color:'#1a1a1a'}}>$299<span style={{fontSize:18,fontWeight:400,color:'#6b7280'}}> USD/mes</span></div>
            <div style={{fontSize:13,color:'#6b7280',marginTop:4,marginBottom:24}}>Facturación mensual · Cancelá cuando quieras</div>
            <div style={{textAlign:'left',fontSize:14,color:'#374151',lineHeight:2}}>
              {'Inventario ilimitado,Ventas y facturación,Rutas con GPS y tracking,Portal B2B para tus clientes,Dashboard con KPIs,Usuarios ilimitados,Soporte por WhatsApp,Sin costo de implementación'.split(',').map(f=>(
                <div key={f}>✓ {f}</div>
              ))}
            </div>
            <button onClick={()=>window.location.href='/'}
              style={{marginTop:24,width:'100%',padding:'14px',background:G,color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>
              Empezar gratis
            </button>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div style={{maxWidth:700,margin:'0 auto',padding:'60px 20px'}}>
        <h2 style={{fontFamily:F.serif,fontSize:28,textAlign:'center',marginBottom:32,color:'#1a1a1a'}}>Comparación</h2>
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f5f5f7'}}>
                <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,color:'#374151'}}>Feature</th>
                <th style={{textAlign:'center',padding:'12px 16px',fontWeight:700,color:G}}>Aryes</th>
                <th style={{textAlign:'center',padding:'12px 16px',fontWeight:600,color:'#6b7280'}}>SimpliRoute</th>
                <th style={{textAlign:'center',padding:'12px 16px',fontWeight:600,color:'#6b7280'}}>WIS</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map(c=>(
                <tr key={c.feature} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'10px 16px',color:'#374151'}}>{c.feature}</td>
                  <td style={{textAlign:'center',padding:'10px 16px',fontWeight:700,color:typeof c.aryes==='string'?G:c.aryes?'#16a34a':'#dc2626'}}>{typeof c.aryes==='string'?c.aryes:c.aryes?'✓':'—'}</td>
                  <td style={{textAlign:'center',padding:'10px 16px',color:typeof c.simpli==='string'?'#374151':c.simpli?'#16a34a':'#dc2626'}}>{typeof c.simpli==='string'?c.simpli:c.simpli?'✓':'—'}</td>
                  <td style={{textAlign:'center',padding:'10px 16px',color:typeof c.wis==='string'?'#374151':c.wis?'#16a34a':'#dc2626'}}>{typeof c.wis==='string'?c.wis:c.wis?'✓':'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{background:'#1a1a18',color:'#a8a8a6',padding:'40px 20px',textAlign:'center',fontSize:13}}>
        <div>Aryes Stock · Plataforma para distribuidoras</div>
        <div style={{marginTop:8}}>Montevideo, Uruguay · info@aryes.com</div>
      </div>
    </div>
  );
}

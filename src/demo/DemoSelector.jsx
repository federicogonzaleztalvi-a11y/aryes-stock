import { useState } from 'react';
import { DEMO_INDUSTRIES } from './datasets.js';

const COLORS = { horeca:'#059669', bebidas:'#185FA5', limpieza:'#0F6E56', construccion:'#BA7517' };
const EMPRESA = {
  horeca: { name:'Distribuciones Del Sur S.R.L.', skus:'250 productos', clientes:'45 clientes', examples:'Quesos, fiambres, aceites, harinas, lácteos, conservas' },
  bebidas: { name:'Bebidas Express S.A.', skus:'180 productos', clientes:'60 clientes', examples:'Cervezas, refrescos, aguas, jugos, vinos, espirituosas' },
  limpieza: { name:'HigienePro Uruguay S.R.L.', skus:'320 productos', clientes:'80 clientes', examples:'Desinfectantes, jabones, papel, bolsas, químicos' },
  construccion: { name:'MatCon Distribuidora S.A.', skus:'420 productos', clientes:'35 clientes', examples:'Cemento, hierro, pinturas, herramientas, sanitaria' },
};

export default function DemoSelector({ onSelect }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f7', padding:20, fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif" }}>
      <style>{`@keyframes dsFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}.ds-card{transition:all .15s ease;}.ds-card:hover{border-color:#c8c8cc !important;}`}</style>
      <div style={{ maxWidth:440, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src="/pazque-logo.png" alt="Pazque" style={{ height:32, objectFit:'contain', marginBottom:16 }} onError={e => e.target.style.display='none'} />
          <p style={{ fontSize:20, fontWeight:600, color:'#1d1d1f', margin:'0 0 4px', letterSpacing:'-0.02em' }}>¿Qué tipo de distribuidora operás?</p>
          <p style={{ fontSize:13, color:'#86868b', margin:0 }}>Elegí una industria para explorar</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
          {DEMO_INDUSTRIES.map((ind) => {
            const isSel = selected === ind.id;
            const color = COLORS[ind.id];
            return (
              <div key={ind.id} className="ds-card" onClick={() => setSelected(ind.id)} style={{ background:'#fff', border:isSel?'1.5px solid '+color:'1px solid #e5e5e7', borderRadius:10, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:isSel ? color : '#f5f5f7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .15s' }}>
                  <span style={{ fontSize:15, color:isSel ? '#fff' : color, fontWeight:600, letterSpacing:'-0.02em' }}>{ind.name.charAt(0)}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:500, color:'#1d1d1f', margin:0 }}>{ind.name}</p>
                  <p style={{ fontSize:12, color:'#86868b', margin:0 }}>{ind.sub}</p>
                </div>
                {isSel && <div style={{ width:18, height:18, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>}
              </div>
            );
          })}
        </div>
        {selected && (
          <div style={{ animation:'dsFadeIn 0.2s ease', marginBottom:12 }}>
            <div style={{ background:'#fff', border:'1px solid #e5e5e7', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
              <p style={{ fontWeight:500, fontSize:13, margin:'0 0 2px', color:'#1d1d1f' }}>{EMPRESA[selected].name}</p>
              <p style={{ fontSize:12, color:'#86868b', margin:'0 0 8px' }}>{EMPRESA[selected].skus} · {EMPRESA[selected].clientes}</p>
              <p style={{ fontSize:12, color:'#86868b', margin:'0 0 2px' }}>Catálogo incluye</p>
              <p style={{ fontSize:12, color:'#4a4a48', margin:0 }}>{EMPRESA[selected].examples}</p>
            </div>
            <button onClick={() => onSelect(selected)} style={{ width:'100%', padding:'11px 0', background:COLORS[selected], color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:'0.02em', textTransform:'uppercase', transition:'opacity .15s' }}
              onMouseEnter={e => e.target.style.opacity='0.9'}
              onMouseLeave={e => e.target.style.opacity='1'}
            >
              Explorar {DEMO_INDUSTRIES.find(i => i.id === selected)?.name}
            </button>
          </div>
        )}
        <div style={{ textAlign:'center', marginTop:8 }}>
          <button onClick={() => { window.location.href = '/'; }} style={{ background:'none', border:'none', color:'#86868b', fontSize:12, cursor:'pointer', padding:'6px 12px' }}>← Volver al login</button>
        </div>
      </div>
    </div>
  );
}

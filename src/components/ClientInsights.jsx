import React from 'react';

const G = '#059669';

export default function ClientInsights({ cliente, metrics, ventas, products }) {
  if (!metrics || metrics.ventasCount === 0) return null;
  const insights = [];

  // 1. Frecuencia de compra y prediccion
  if (metrics.ventasCount >= 2 && metrics.allVentas && metrics.allVentas.length >= 2) {
    const fechas = metrics.allVentas.map(function(v) { return new Date(v.creadoEn).getTime(); }).sort(function(a,b) { return b - a; });
    const intervals = [];
    for (var i = 0; i < fechas.length - 1; i++) intervals.push((fechas[i] - fechas[i+1]) / 86400000);
    var avgInterval = Math.round(intervals.reduce(function(s,v) { return s+v; }, 0) / intervals.length);
    var diasDesde = metrics.diasDesdeUltima;
    var diasParaProximo = Math.max(0, avgInterval - diasDesde);
    
    if (diasDesde > avgInterval * 1.3) {
      var waUrl = cliente.telefono ? 'https://wa.me/' + cliente.telefono.replace(/\D/g,'') + '?text=Hola ' + encodeURIComponent((cliente.nombre||'').split(' ')[0]) + ', necesitas reponer stock?' : null;
      insights.push({ icon: '\u{1F534}', type: 'danger', title: 'Cliente en riesgo de perdida',
        text: 'Compra cada ~' + avgInterval + ' dias pero lleva ' + diasDesde + ' dias sin pedir. Contactalo hoy.',
        action: waUrl, actionLabel: '\u{1F4AC} Enviar WhatsApp' });
    } else if (diasDesde > avgInterval * 0.8) {
      insights.push({ icon: '\u{1F7E1}', type: 'warning', title: 'Proximo pedido estimado: pronto',
        text: 'Compra cada ~' + avgInterval + ' dias. Deberia pedir en ' + diasParaProximo + ' dia' + (diasParaProximo !== 1 ? 's' : '') + '.' });
    } else {
      insights.push({ icon: '\u{1F7E2}', type: 'ok', title: 'Frecuencia de compra normal',
        text: 'Compra cada ~' + avgInterval + ' dias. Proximo pedido en ~' + diasParaProximo + ' dias.' });
    }
  }

  // 2. Cross-sell
  if (products && products.length > 0 && metrics.allVentas && metrics.allVentas.length > 0) {
    var comprados = new Set();
    metrics.allVentas.forEach(function(v) { (v.items||[]).forEach(function(it) { comprados.add(it.productoId || it.nombre); }); });
    var prodFreq = {};
    ventas.filter(function(v) { return v.estado !== 'cancelada'; }).forEach(function(v) {
      (v.items||[]).forEach(function(it) { var k = it.productoId || it.nombre; prodFreq[k] = (prodFreq[k]||0) + 1; });
    });
    var noCompra = Object.entries(prodFreq)
      .filter(function(e) { return !comprados.has(e[0]); })
      .sort(function(a,b) { return b[1] - a[1]; })
      .slice(0, 3)
      .map(function(e) { var p = products.find(function(p) { return p.id === e[0]; }); return p ? (p.nombre || p.name) : e[0]; })
      .filter(Boolean);
    if (noCompra.length > 0) {
      insights.push({ icon: '\u{1F4A1}', type: 'opportunity', title: 'Oportunidad de cross-sell',
        text: 'Productos populares que nunca pidio: ' + noCompra.join(', ') + '.' });
    }
  }

  // 3. Tendencia de ticket
  if (metrics.allVentas && metrics.allVentas.length >= 4) {
    var mitad = Math.floor(metrics.allVentas.length / 2);
    var tR = metrics.allVentas.slice(0, mitad).reduce(function(s,v) { return s + Number(v.total||0); }, 0) / mitad;
    var tA = metrics.allVentas.slice(mitad).reduce(function(s,v) { return s + Number(v.total||0); }, 0) / (metrics.allVentas.length - mitad);
    var cambio = ((tR - tA) / tA * 100);
    if (cambio < -15) {
      insights.push({ icon: '\u{1F4C9}', type: 'warning', title: 'Ticket promedio en baja',
        text: 'Bajo ' + Math.abs(Math.round(cambio)) + '% ($' + Math.round(tR) + ' vs $' + Math.round(tA) + ').' });
    } else if (cambio > 20) {
      insights.push({ icon: '\u{1F4C8}', type: 'ok', title: 'Ticket en alza',
        text: 'Subio ' + Math.round(cambio) + '%. Buen momento para ofrecer productos premium.' });
    }
  }

  // 4. Mejor dia
  if (metrics.allVentas && metrics.allVentas.length >= 3) {
    var dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    var dc = [0,0,0,0,0,0,0];
    metrics.allVentas.forEach(function(v) { dc[new Date(v.creadoEn).getDay()]++; });
    var best = dc.indexOf(Math.max.apply(null, dc));
    var pct = Math.round((dc[best] / metrics.allVentas.length) * 100);
    if (pct > 30) {
      insights.push({ icon: '\u{1F4C5}', type: 'info', title: 'Mejor dia para contactar',
        text: 'El ' + pct + '% de sus pedidos son los ' + dias[best] + '.' });
    }
  }

  // Score
  var score = Math.min(100, Math.round(
    (Math.min(metrics.ventasCount, 20) / 20 * 30) +
    (Math.min(metrics.totalComprado, 50000) / 50000 * 30) +
    (metrics.margenPct > 0 ? Math.min(metrics.margenPct, 40) / 40 * 20 : 10) +
    (metrics.diasDesdeUltima != null ? Math.max(0, 20 - metrics.diasDesdeUltima / 3) : 0)
  ));
  var scoreColor = score >= 70 ? G : score >= 40 ? '#d97706' : '#dc2626';
  var scoreLabel = score >= 70 ? 'Cliente premium' : score >= 40 ? 'Cliente regular' : 'Cliente en riesgo';

  if (insights.length === 0) return null;

  var COLORS = {
    danger:      { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    warning:     { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    ok:          { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    opportunity: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    info:        { bg: '#f9f9f7', border: '#e2e2de', text: '#4a4a48' },
  };

  return (
    <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>{'\u{1F9E0}'} Insights IA</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontSize:11,fontWeight:600,color:scoreColor}}>{scoreLabel}</div>
          <div style={{width:36,height:36,borderRadius:'50%',border:'3px solid '+scoreColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:scoreColor}}>{score}</div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {insights.map(function(ins, i) {
          var c = COLORS[ins.type] || COLORS.info;
          return (
            <div key={i} style={{background:c.bg,border:'1px solid '+c.border,borderRadius:8,padding:'10px 14px'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                <span style={{fontSize:16,lineHeight:'20px'}}>{ins.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:c.text,marginBottom:2}}>{ins.title}</div>
                  <div style={{fontSize:12,color:'#4a4a48',lineHeight:'1.4'}}>{ins.text}</div>
                </div>
                {ins.action && <a href={ins.action} target="_blank" rel="noreferrer"
                  style={{fontSize:11,fontWeight:700,color:G,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 10px',textDecoration:'none',whiteSpace:'nowrap'}}>
                  {ins.actionLabel}</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

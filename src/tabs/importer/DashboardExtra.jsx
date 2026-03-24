import { T } from '../../lib/ui.jsx';

// eslint-disable-next-line no-unused-vars
const generateOrderPDF = (order, suppliers, products) => {
  const sup = suppliers.find(s => s.id === order.supplierId) || {};
  const today = new Date().toLocaleDateString('es-UY');
  const orderNum = 'OC-' + Date.now().toString().slice(-6);

  const rows = (order.items || []).map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    const subtotal = (item.qty * (prod.unitCost || 0)).toFixed(2);
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:10px 12px">${prod.name || item.productName || ''}</td>
      <td style="padding:10px 12px;text-align:center">${item.qty} ${prod.unit || ''}</td>
      <td style="padding:10px 12px;text-align:right">$ ${(prod.unitCost || 0).toFixed(2)}</td>
      <td style="padding:10px 12px;text-align:right">$ ${subtotal}</td>
    </tr>`;
  }).join('');

  const total = (order.items || []).reduce((sum, item) => {
    const prod = products.find(p => p.id === item.productId) || {};
    return sum + item.qty * (prod.unitCost || 0);
  }, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orden de Compra ${orderNum}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a18; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #3a7d1e; padding-bottom: 24px; }
    .logo-area h1 { font-size: 28px; color: #3a7d1e; margin: 0 0 4px; font-weight: 700; }
    .logo-area p { color: #6a6a68; margin: 0; font-size: 13px; }
    .oc-info { text-align: right; }
    .oc-info .num { font-size: 22px; font-weight: 700; color: #1a1a18; }
    .oc-info .date { color: #6a6a68; font-size: 13px; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; color: #9a9a98; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    .sup-box { background: #f9f9f7; border: 1px solid #e2e2de; border-radius: 8px; padding: 16px 20px; }
    .sup-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .sup-detail { font-size: 13px; color: #6a6a68; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead { background: #f9f9f7; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6a6a68; text-transform: uppercase; letter-spacing: .07em; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(2) { text-align: right; }
    .total-row { background: #f0f7ec; }
    .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e2de; display: flex; justify-content: space-between; }
    .sign-box { text-align: center; }
    .sign-line { width: 180px; border-top: 1px solid #3a3a38; margin: 40px auto 8px; }
    .sign-label { font-size: 12px; color: #6a6a68; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-top: 16px; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>ARYES</h1>
      <p>Distribuidora de Insumos Gastronómicos</p>
      <p>Montevideo, Uruguay</p>
    </div>
    <div class="oc-info">
      <div class="num">Orden de Compra</div>
      <div class="num" style="color:#3a7d1e">${orderNum}</div>
      <div class="date">Fecha: ${today}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Proveedor</div>
    <div class="sup-box">
      <div class="sup-name">${sup.name || order.supplierId || ''}</div>
      ${sup.company ? `<div class="sup-detail">${sup.company}</div>` : ''}
      ${sup.contact ? `<div class="sup-detail">Contacto: ${sup.contact}</div>` : ''}
      ${sup.email ? `<div class="sup-detail">Email: ${sup.email}</div>` : ''}
      ${sup.phone ? `<div class="sup-detail">Tel: ${sup.phone}</div>` : ''}
      <div class="sup-detail" style="margin-top:6px">
        Plazo de pago: ${sup.paymentTerms || '30'} días · Moneda: ${sup.currency || 'USD'}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle de productos</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center">Cantidad</th>
          <th style="text-align:right">Precio unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;padding:14px 12px;font-weight:700">TOTAL ESTIMADO</td>
          <td style="text-align:right;padding:14px 12px;font-weight:700;color:#3a7d1e">$ ${total.toFixed(2)} ${sup.currency || 'USD'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${order.notes ? `<div class="notes">📝 <strong>Notas:</strong> ${order.notes}</div>` : ''}

  <div class="footer">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Solicitado por</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Autorizado por</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#9a9a98;align-self:flex-end">
      <div>Importar catálogo</div>
      <div>Generado el ${today}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('',"_blank","noopener,noreferrer");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
};

// ── Dashboard Charts Components ─────────────────────────────────────────
const MiniBar=({value,max,color='#3a7d1e'})=>{
  const pct=max>0?Math.min(100,Math.round(value/max*100)):0;
  return <div style={{width:'100%',height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden'}}>
    <div style={{width:pct+'%',height:'100%',background:color,borderRadius:3,transition:'width .3s'}}/>
  </div>;
};

// eslint-disable-next-line no-unused-vars
const DashboardExtra=({products,suppliers,orders})=>{
  // Valor total inventario
  const totalValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
  const totalSaleValue = products.reduce((s,p)=>s+(p.stock||0)*(p.salePrice||p.unitCost||0),0);
  const totalMargin = totalSaleValue - totalValue;

  // Top 10 productos por valor en stock
  const byValue = [...products]
    .filter(p=>p.stock>0&&p.unitCost>0)
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost))
    .slice(0,10);
  const maxVal = byValue[0]?(byValue[0].stock*byValue[0].unitCost):1;

  // Rotación por marca
  const byBrand = {};
  products.forEach(p=>{
    if(!p.brand) return;
    if(!byBrand[p.brand]) byBrand[p.brand]={brand:p.brand,count:0,value:0,lowStock:0};
    byBrand[p.brand].count++;
    byBrand[p.brand].value += (p.stock||0)*(p.unitCost||0);
    if((p.stock||0)<(p.minStock||5)) byBrand[p.brand].lowStock++;
  });
  const brands = Object.values(byBrand).sort((a,b)=>b.value-a.value);
  const maxBrandVal = brands[0]?.value||1;

  // Proyección quiebres próximos 30 días
  const today = new Date();
  const breakRisk = products.filter(p=>{
    const daily = p.dailyUsage||0.5;
    const daysLeft = daily>0?(p.stock||0)/daily:999;
    return daysLeft<30 && daysLeft>0;
  }).sort((a,b)=>{
    const da=(a.dailyUsage||.5)>0?(a.stock||0)/(a.dailyUsage||.5):999;
    const db=(b.dailyUsage||.5)>0?(b.stock||0)/(b.dailyUsage||.5):999;
    return da-db;
  }).slice(0,8);

  // Stock por proveedor
  const bySupplier = {};
  products.forEach(p=>{
    const s = p.supplierId||'arg';
    if(!bySupplier[s]) bySupplier[s]={id:s,count:0,value:0};
    bySupplier[s].count++;
    bySupplier[s].value += (p.stock||0)*(p.unitCost||0);
  });

  const supNames = {arg:'Argentina',ecu:'Ecuador',eur:'Europa',other:'Otros'};
  const supColors = {arg:'#2563eb',ecu:'#16a34a',eur:'#7c3aed',other:'#9a9a98'};

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginTop:24}}>

      {/* Valor de inventario */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,gridColumn:'1/-1'}}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          {[
            {label:'Valor en stock (costo)',value:'$ '+totalValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#3a3a38',bg:'#f9f9f7'},
            {label:'Valor en stock (venta)',value:'$ '+totalSaleValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#2563eb',bg:'#eff6ff'},
            {label:'Margen potencial',value:'$ '+totalMargin.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#16a34a',bg:'#f0fdf4'},
            {label:'Productos en stock',value:products.filter(p=>p.stock>0).length+' / '+products.length,color:'#3a3a38',bg:'#f9f9f7'},
          ].map(({label,value,color,bg})=>(
            <div key={label} style={{flex:1,minWidth:180,background:bg,borderRadius:10,padding:'16px 20px'}}>
              <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{label}</div>
              <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos por valor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Top 10 por valor en stock</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {byValue.map((p,i)=>{
            const val = p.stock*p.unitCost;
            return <div key={p.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:12,color:'#3a3a38',fontWeight:500,flex:1,marginRight:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}. {p.name}</span>
                <span style={{fontSize:12,color:'#6a6a68',flexShrink:0}}>$ {val.toFixed(0)}</span>
              </div>
              <MiniBar value={val} max={maxVal} color={i<3?'#3a7d1e':'#b8d9a8'}/>
            </div>;
          })}
        </div>
      </div>

      {/* Rotación por marca */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Inventario por marca</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {brands.map(b=>(
            <div key={b.brand}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600}}>{b.brand}</span>
                <div style={{display:'flex',gap:12,fontSize:11,color:'#6a6a68'}}>
                  <span>{b.count} prod.</span>
                  {b.lowStock>0&&<span style={{color:'#dc2626',fontWeight:600}}>⚠ {b.lowStock} bajo mín.</span>}
                  <span style={{fontWeight:600,color:'#3a3a38'}}>$ {b.value.toFixed(0)}</span>
                </div>
              </div>
              <MiniBar value={b.value} max={maxBrandVal}/>
            </div>
          ))}
        </div>
      </div>

      {/* Proyección de quiebres */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Proyección quiebres — próx. 30 días</div>
        {breakRisk.length===0
          ?<div style={{textAlign:'center',padding:'24px 0',color:'#9a9a98',fontSize:13}}>✅ Sin riesgo de quiebre en 30 días</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {breakRisk.map(p=>{
              const daysLeft = (p.dailyUsage||.5)>0?(p.stock||0)/(p.dailyUsage||.5):999;
              const urgency = daysLeft<7?'#dc2626':daysLeft<15?'#d97706':'#2563eb';
              return <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#f9f9f7',borderRadius:8,borderLeft:'3px solid '+urgency}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#1a1a18'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'#9a9a98'}}>{p.brand} · stock: {p.stock} {p.unit}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:urgency}}>{Math.ceil(daysLeft)}d</div>
                  <div style={{fontSize:10,color:'#9a9a98'}}>restantes</div>
                </div>
              </div>;
            })}
          </div>
        }
      </div>

      {/* Stock por proveedor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Distribución por proveedor</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {Object.values(bySupplier).sort((a,b)=>b.value-a.value).map(s=>{
            const pct = totalValue>0?Math.round(s.value/totalValue*100):0;
            const sup = suppliers.find(x=>x.id===s.id)||{};
            return <div key={s.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:supColors[s.id]||'#9a9a98',display:'inline-block'}}/>
                  {sup.name||supNames[s.id]||s.id}
                </span>
                <div style={{fontSize:11,color:'#6a6a68',display:'flex',gap:12}}>
                  <span>{s.count} prod.</span>
                  <span style={{fontWeight:600}}>{pct}%</span>
                </div>
              </div>
              <MiniBar value={s.value} max={totalValue} color={supColors[s.id]||'#9a9a98'}/>
            </div>;
          })}
        </div>
      </div>

    </div>
  );
};



// ── Price History Tab ────────────────────────────────────────────────────

export { generateOrderPDF, MiniBar, DashboardExtra };

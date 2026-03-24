import { useState } from 'react';
import { LS } from '../../lib/constants.js';

// eslint-disable-next-line no-unused-vars
const PriceHistoryTab=({products,session})=>{
  const [priceHistory,_setPriceHistory]=useState(()=>LS.get('aryes-price-history',[]));
  const [selProduct,setSelProduct]=useState('');
  const [search,setSearch]=useState('');

  const filtered = selProduct
    ? priceHistory.filter(h=>h.productId===selProduct)
    : search
    ? priceHistory.filter(h=>h.productName.toLowerCase().includes(search.toLowerCase()))
    : priceHistory;

  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Group by product for summary view
  const byProduct = {};
  priceHistory.forEach(h=>{
    if(!byProduct[h.productId]) byProduct[h.productId]={name:h.productName,entries:[]};
    byProduct[h.productId].entries.push(h);
  });

  const productSummaries = Object.values(byProduct).map(p=>{
    const sorted = [...p.entries].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const latest = sorted[0];
    const prev = sorted[1];
    const change = prev ? ((latest.cost - prev.cost)/prev.cost*100).toFixed(1) : null;
    return {...p, latest, prev, change};
  }).sort((a,b)=>new Date(b.latest.date)-new Date(a.latest.date));

  return(
    <div style={{padding:'32px 40px',maxWidth:900}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Análisis de costos</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Historial de Precios</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Los cambios de costo se registran automáticamente cada vez que editás un producto.</p>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setSelProduct('');}} placeholder="Buscar producto..."
          style={{flex:1,minWidth:200,padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        <select value={selProduct} onChange={e=>{setSelProduct(e.target.value);setSearch('');}}
          style={{padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff',minWidth:220}}>
          <option value=''>Todos los productos</option>
          {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selProduct&&!search?(
        // Summary view
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Últimos cambios de precio</div>
          {productSummaries.length===0
            ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>Los cambios de precio aparecerán acá automáticamente</div></div>
            :<div style={{display:'flex',flexDirection:'column',gap:8}}>
              {productSummaries.slice(0,20).map((p,i)=>{
                const up = p.change!==null&&Number(p.change)>0;
                const down = p.change!==null&&Number(p.change)<0;
                return <div key={i} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a18',marginBottom:2}}>{p.name}</div>
                    <div style={{fontSize:11,color:'#9a9a98'}}>{p.latest.brand} · {new Date(p.latest.date).toLocaleDateString('es-UY')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>$ {p.latest.cost.toFixed(2)}</div>
                    {p.change!==null&&<div style={{fontSize:11,fontWeight:600,color:up?'#dc2626':down?'#16a34a':'#9a9a98'}}>
                      {up?'↑':'↓'} {Math.abs(p.change)}% {down?'(bajó)':'(subió)'}
                    </div>}
                  </div>
                </div>;
              })}
            </div>
          }
        </div>
      ):(
        // Detail view for specific product
        <div>
          {selProduct&&<div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#3a7d1e',fontWeight:600}}>
            {products.find(p=>p.id===selProduct)?.name}
          </div>}
          {sorted.length===0
            ?<div style={{textAlign:'center',padding:'32px',color:'#9a9a98'}}>Sin registros</div>
            :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#f9f9f7'}}>
                  {['Fecha','Producto','Costo anterior','Costo nuevo','Variación','Registrado por'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sorted.map((h,i)=>{
                    const change = h.prevCost>0?((h.cost-h.prevCost)/h.prevCost*100).toFixed(1):null;
                    const up = change!==null&&Number(change)>0;
                    return <tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{new Date(h.date).toLocaleDateString('es-UY')}</td>
                      <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a18'}}>{h.productName}</td>
                      <td style={{padding:'10px 14px',color:'#9a9a98'}}>{h.prevCost>0?'$ '+h.prevCost.toFixed(2):'—'}</td>
                      <td style={{padding:'10px 14px',fontWeight:600,color:'#1a1a18'}}>$ {h.cost.toFixed(2)}</td>
                      <td style={{padding:'10px 14px'}}>
                        {change!==null?<span style={{color:up?'#dc2626':'#16a34a',fontWeight:600}}>{up?'↑ +':'↓ '}{change}%</span>:<span style={{color:'#9a9a98'}}>—</span>}
                      </td>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{h.user||'—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}
    </div>
  );
};



// ── Clients Tab ──────────────────────────────────────────────────────────

export { PriceHistoryTab };

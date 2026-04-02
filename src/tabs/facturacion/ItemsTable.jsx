import React from 'react';
import { G, F, IVA_RATES, fmtMoney } from './constants.js';

function ItemsTable({ items, setItems, moneda }) {
  const [editCell, setEditCell] = React.useState(null); // {id, field}

  const updateItem = (id, field, val) => {
    setItems(prev => prev.map(it =>
      it.id === id ? { ...it, [field]: field==='iva'?Number(val):field==='desc'?val:parseFloat(val)||0 } : it
    ));
    setEditCell(null);
  };

  if (!items.length) return (
    <div style={{ border:'1.5px dashed #e2e2de', borderRadius:10, padding:'20px',
      textAlign:'center', color:'#9a9a98', fontFamily:F.sans, fontSize:13, marginBottom:12 }}>
      Sin líneas aún — buscá un producto arriba o escribí la descripción
    </div>
  );

  return (
    <div style={{ border:'1px solid #e2e2de', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:F.sans, fontSize:13 }}>
        <thead>
          <tr style={{ background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
            {['#','Descripción','Cant.','Precio unit.','IVA','Total',''].map(h=>
              <th key={h} style={{ padding:'8px 12px',
                textAlign: ['Cant.','Precio unit.','Total'].includes(h)?'right':h==='#'||h===''?'center':'left',
                fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.09em',
                textTransform:'uppercase', color:'#9a9a98', whiteSpace:'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const lineTotal = it.cant * it.precio * (1 + it.iva/100);
            return (
              <tr key={it.id} style={{ borderBottom:'1px solid #f0f0ec',
                background: i%2===0?'#fff':'#fafaf8' }}>
                {/* # */}
                <td style={{ padding:'8px 12px', textAlign:'center', color:'#9a9a98', fontSize:11, width:32 }}>{i+1}</td>

                {/* Desc — inline editable */}
                <td style={{ padding:'4px 8px' }}>
                  {editCell?.id===it.id && editCell.field==='desc'
                    ? <input autoFocus defaultValue={it.desc}
                        onBlur={e=>updateItem(it.id,'desc',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:'100%', boxSizing:'border-box', padding:'5px 8px',
                          border:`1.5px solid ${G}`, borderRadius:5, fontFamily:F.sans,
                          fontSize:13, outline:'none', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'desc'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontWeight:500,
                          color:'#1a1a18', borderRadius:4, minHeight:28,
                          ':hover':{background:'#f0f7ec'} }}>
                        {it.desc}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:4 }}>✎</span>
                      </div>
                  }
                </td>

                {/* Cant — inline editable */}
                <td style={{ padding:'4px 8px', textAlign:'right', width:70 }}>
                  {editCell?.id===it.id && editCell.field==='cant'
                    ? <input autoFocus type="number" defaultValue={it.cant} min="0.001" step="any"
                        onFocus={e=>e.target.select()}
                        onBlur={e=>updateItem(it.id,'cant',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:70, padding:'5px 6px', border:`1.5px solid ${G}`,
                          borderRadius:5, fontFamily:F.mono, fontSize:13, outline:'none',
                          textAlign:'right', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'cant'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontFamily:F.mono,
                          textAlign:'right', color:'#3a3a38' }}>
                        {it.cant}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:2 }}>✎</span>
                      </div>
                  }
                </td>

                {/* Precio — inline editable */}
                <td style={{ padding:'4px 8px', textAlign:'right', width:110 }}>
                  {editCell?.id===it.id && editCell.field==='precio'
                    ? <input autoFocus type="number" defaultValue={it.precio} min="0" step="0.01"
                        onFocus={e=>e.target.select()}
                        onBlur={e=>updateItem(it.id,'precio',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:100, padding:'5px 6px', border:`1.5px solid ${G}`,
                          borderRadius:5, fontFamily:F.mono, fontSize:13, outline:'none',
                          textAlign:'right', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'precio'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontFamily:F.mono,
                          textAlign:'right', color:'#3a3a38' }}>
                        {fmt.currency(it.precio, moneda)}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:2 }}>✎</span>
                      </div>
                  }
                </td>

                {/* IVA */}
                <td style={{ padding:'8px 12px', textAlign:'right', width:70 }}>
                  <select value={it.iva}
                    onChange={e=>updateItem(it.id,'iva',e.target.value)}
                    style={{ border:'none', background:'transparent', fontFamily:F.sans,
                      fontSize:12, color:'#6a6a68', cursor:'pointer', outline:'none' }}>
                    {IVA_RATES.map(r=><option key={r} value={r}>{r===0?'Ex':r+'%'}</option>)}
                  </select>
                </td>

                {/* Total */}
                <td style={{ padding:'8px 12px', textAlign:'right', width:110 }}>
                  <span style={{ fontFamily:F.serif, fontSize:15, color:G }}>
                    {fmt.currency(lineTotal, moneda)}
                  </span>
                </td>

                {/* Delete */}
                <td style={{ padding:'8px 10px', textAlign:'center', width:36 }}>
                  <button onClick={()=>setItems(prev=>prev.filter(x=>x.id!==it.id))}
                    title="Eliminar línea"
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#d1d5db', fontSize:16, lineHeight:1, padding:2,
                      borderRadius:4, transition:'color .1s' }}
                    onMouseEnter={e=>e.currentTarget.style.color='#dc2626'}
                    onMouseLeave={e=>e.currentTarget.style.color='#d1d5db'}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding:'6px 14px', background:'#f9f9f7', borderTop:'1px solid #f0f0ec',
        fontFamily:F.sans, fontSize:10, color:'#c8c8c4' }}>
        Click en cualquier celda para editar · IVA cambiable directo en cada línea
      </div>
    </div>
  );
}

// ─── Modal Factura ─────────────────────────────────────────────────────────

export default ItemsTable;

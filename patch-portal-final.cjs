#!/usr/bin/env node
// patch-portal-final.cjs — Editable qty + IVA + min order qty (template literals)

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// ═══════════════════════════════════════════════════════════════
// 1. Editable qty input — replace the span between - and + 
//    Use a VERY specific unique anchor to avoid double matching
// ═══════════════════════════════════════════════════════════════

const oldQty = `<span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', flex: 1, textAlign: 'center' }}>{qty}</span>`;

const newQty = `<input type="number" inputMode="numeric" min="0" value={qty} onChange={e=>{const v=parseInt(e.target.value,10);if(isNaN(v)||v<=0)onRemove(item);else{const d=v-qty;if(d>0)for(let i=0;i<d;i++)onAdd(item);else if(d<0)for(let i=0;i<-d;i++)onRemove(item);}}} onFocus={e=>e.target.select()} style={{width:48,fontSize:15,fontWeight:700,color:'#1a1a18',textAlign:'center',border:'1px solid #e0e0d8',borderRadius:6,padding:'2px 0',outline:'none',background:'#fafaf7'}}/>`;

// Only replace the FIRST occurrence
const qtyIdx = pg.indexOf(oldQty);
if (qtyIdx !== -1) {
  pg = pg.slice(0, qtyIdx) + newQty + pg.slice(qtyIdx + oldQty.length);
  console.log('✅ 1/5 Editable qty input');
} else {
  console.log('⚠️  qty span not found');
}

// ═══════════════════════════════════════════════════════════════
// 2. IVA breakdown — add a component ABOVE the price div instead of inline
//    This avoids the string literal issue entirely
// ═══════════════════════════════════════════════════════════════

// Add an IvaLine helper function at the top of the file (after imports)
const ivaHelper = `
function IvaLine({ precio, iva_rate }) {
  const iva = Number(iva_rate || 22);
  if (precio <= 0) return null;
  const sinIva = Math.round(precio / (1 + iva / 100));
  return React.createElement('div', { style: { fontSize: 10, color: '#b0b0a8', marginTop: 1 } },
    iva > 0 ? ('\u0024' + sinIva.toLocaleString() + ' + IVA ' + iva + '%') : 'Exento de IVA'
  );
}
`;

const helperAnchor = '// ── Login';
if (!pg.includes('function IvaLine')) {
  pg = pg.replace(helperAnchor, ivaHelper + '\n' + helperAnchor);
  console.log('✅ 2/5 IvaLine helper component added');
} else {
  console.log('⏭  IvaLine already exists');
}

// Now insert <IvaLine> in ProductCard after the price div
// Target the unique closing pattern of the price section
const priceClose = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {qty > 0 ? (`;

const priceCloseWithIva = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {item.precio > 0 && <IvaLine precio={item.precio} iva_rate={item.iva_rate} />}
        {qty > 0 ? (`;

// Only replace the FIRST occurrence
const priceIdx = pg.indexOf(priceClose);
if (priceIdx !== -1) {
  pg = pg.slice(0, priceIdx) + priceCloseWithIva + pg.slice(priceIdx + priceClose.length);
  console.log('✅ 3/5 IvaLine inserted in ProductCard');
} else {
  console.log('⚠️  Price close pattern not found');
}

// ═══════════════════════════════════════════════════════════════
// 3. Min order qty on button + addItem/removeItem logic
// ═══════════════════════════════════════════════════════════════

// Button text
const oldBtn = "{item.precio > 0 ? '+ Agregar' : 'Sin precio'}";
const btnIdx = pg.indexOf(oldBtn);
if (btnIdx !== -1) {
  const newBtn = "{item.precio > 0 ? (item.min_order_qty > 1 ? ('+ Min. ' + item.min_order_qty) : '+ Agregar') : 'Sin precio'}";
  pg = pg.slice(0, btnIdx) + newBtn + pg.slice(btnIdx + oldBtn.length);
  console.log('✅ 4/5 Min qty on Agregar button');
} else {
  console.log('⚠️  Agregar button text not found');
}

// addItem — first add sets min qty
const oldAdd = "const addItem    = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 })); };";
const newAdd = "const addItem = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => { const cur = c[item.id] || 0; const min = item.min_order_qty || 1; return { ...c, [item.id]: cur === 0 ? min : cur + 1 }; }); };";

if (pg.includes(oldAdd)) {
  pg = pg.replace(oldAdd, newAdd);
  console.log('✅ 5/5 addItem respects min_order_qty');
} else {
  console.log('⚠️  addItem pattern not found');
}

// removeItem — below min removes entirely
const oldRemove = `const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    if (q <= 0) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });`;
const newRemove = `const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    const min = item.min_order_qty || 1;
    if (q < min) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });`;

if (pg.includes(oldRemove)) {
  pg = pg.replace(oldRemove, newRemove);
  console.log('✅     removeItem respects min_order_qty');
}

// Add min_order_qty to demo product mapping
const oldDemoMap = "imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,";
if (pg.includes(oldDemoMap) && !pg.includes('min_order_qty')) {
  pg = pg.replace(oldDemoMap, oldDemoMap + ' min_order_qty: p.min_order_qty || 1,');
  console.log('✅     min_order_qty in demo mapping');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal UX improvements applied!
  1. Editable qty input (type number directly)
  2. IvaLine component (separate, no string issues)  
  3. IVA breakdown below price
  4. Min order qty on button
  5. addItem/removeItem respect min qty
══════════════════════════════════════════════`);

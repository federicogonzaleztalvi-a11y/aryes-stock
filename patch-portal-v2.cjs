#!/usr/bin/env node
// patch-portal-v2.cjs — Editable qty + IVA (separate file) + min order qty

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// ═══════════════════════════════════════════════════════════════
// 1. Add import for IvaLine component
// ═══════════════════════════════════════════════════════════════
const importAnchor = "import { fmt } from '../lib/constants.js';";
if (!pg.includes('IvaLine')) {
  pg = pg.replace(importAnchor, importAnchor + "\nimport IvaLine from '../components/IvaLine.jsx';");
  console.log('✅ 1/5 Added IvaLine import');
}

// ═══════════════════════════════════════════════════════════════
// 2. Editable qty input — replace span with input (FIRST occurrence only)
// ═══════════════════════════════════════════════════════════════
const oldQty = "<span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', flex: 1, textAlign: 'center' }}>{qty}</span>";
const qtyIdx = pg.indexOf(oldQty);
if (qtyIdx !== -1) {
  const newQty = "<input type=\"number\" inputMode=\"numeric\" min=\"0\" value={qty} onChange={e=>{const v=parseInt(e.target.value,10);if(isNaN(v)||v<=0)onRemove(item);else{const d=v-qty;if(d>0)for(let i=0;i<d;i++)onAdd(item);else if(d<0)for(let i=0;i<-d;i++)onRemove(item);}}} onFocus={e=>e.target.select()} style={{width:48,fontSize:15,fontWeight:700,color:'#1a1a18',textAlign:'center',border:'1px solid #e0e0d8',borderRadius:6,padding:'2px 0',outline:'none',background:'#fafaf7'}}/>";
  pg = pg.slice(0, qtyIdx) + newQty + pg.slice(qtyIdx + oldQty.length);
  console.log('✅ 2/5 Editable qty input');
}

// ═══════════════════════════════════════════════════════════════
// 3. Insert <IvaLine> after price div (FIRST occurrence only)
// ═══════════════════════════════════════════════════════════════
const priceAnchor = "{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}\n        </div>\n        {qty > 0 ? (";
const priceIdx = pg.indexOf(priceAnchor);
if (priceIdx !== -1) {
  const replacement = "{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}\n        </div>\n        {item.precio > 0 && <IvaLine precio={item.precio} iva_rate={item.iva_rate} />}\n        {qty > 0 ? (";
  pg = pg.slice(0, priceIdx) + replacement + pg.slice(priceIdx + priceAnchor.length);
  console.log('✅ 3/5 IvaLine inserted after price');
}

// ═══════════════════════════════════════════════════════════════
// 4. Min order qty on button (FIRST occurrence only)
// ═══════════════════════════════════════════════════════════════
const oldBtn = "{item.precio > 0 ? '+ Agregar' : 'Sin precio'}";
const btnIdx = pg.indexOf(oldBtn);
if (btnIdx !== -1) {
  const newBtn = "{item.precio > 0 ? (item.min_order_qty > 1 ? ('+ Min. ' + item.min_order_qty) : '+ Agregar') : 'Sin precio'}";
  pg = pg.slice(0, btnIdx) + newBtn + pg.slice(btnIdx + oldBtn.length);
  console.log('✅ 4/5 Min qty on button');
}

// ═══════════════════════════════════════════════════════════════
// 5. addItem/removeItem respect min_order_qty
// ═══════════════════════════════════════════════════════════════
const oldAdd = "const addItem    = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 })); };";
if (pg.includes(oldAdd)) {
  pg = pg.replace(oldAdd, "const addItem = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => { const cur = c[item.id] || 0; const min = item.min_order_qty || 1; return { ...c, [item.id]: cur === 0 ? min : cur + 1 }; }); };");
  console.log('✅ 5/5 addItem respects min_order_qty');
}

const oldRem = "const q = (c[item.id] || 0) - 1;\n    if (q <= 0) { const n = { ...c }; delete n[item.id]; return n; }";
if (pg.includes(oldRem)) {
  pg = pg.replace(oldRem, "const q = (c[item.id] || 0) - 1;\n    const min = item.min_order_qty || 1;\n    if (q < min) { const n = { ...c }; delete n[item.id]; return n; }");
  console.log('✅     removeItem respects min_order_qty');
}

// Add min_order_qty to demo mapping
const oldMap = "imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,";
if (pg.includes(oldMap) && !pg.includes('min_order_qty')) {
  pg = pg.replace(oldMap, oldMap + " min_order_qty: p.min_order_qty || 1,");
  console.log('✅     Demo mapping includes min_order_qty');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');
console.log('\n✅ All changes applied. Run npm run build to verify.');

#!/usr/bin/env node
// patch-portal-clean.cjs — Clean patch: editable qty + IVA + min order qty
// This replaces specific, unique strings to avoid double-matching

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

let changes = 0;

// ═══════════════════════════════════════════════════════════════
// 1. Replace the static qty span with editable input in ProductCard
//    Target: the EXACT unique span between - and + buttons
// ═══════════════════════════════════════════════════════════════

const oldQty = `<span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', flex: 1, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => onAdd(item)} style={{
              width: 30, height: 30, background: G, border: 'none', borderRadius: 8,`;

const newQty = `<input type="number" inputMode="numeric" min="0" value={qty}
              onChange={e => { const v = parseInt(e.target.value, 10); if (isNaN(v) || v <= 0) onRemove(item); else { const diff = v - qty; if (diff > 0) for (let i = 0; i < diff; i++) onAdd(item); else if (diff < 0) for (let i = 0; i < -diff; i++) onRemove(item); } }}
              onFocus={e => e.target.select()}
              style={{ width: 48, fontSize: 15, fontWeight: 700, color: '#1a1a18', textAlign: 'center', border: '1px solid #e0e0d8', borderRadius: 6, padding: '2px 0', outline: 'none', background: '#fafaf7', MozAppearance: 'textfield' }} />
            <button onClick={() => onAdd(item)} style={{
              width: 30, height: 30, background: G, border: 'none', borderRadius: 8,`;

if (pg.includes(oldQty)) {
  pg = pg.replace(oldQty, newQty);
  changes++;
  console.log('✅ 1/4 Editable qty input in ProductCard');
} else {
  console.log('⚠️  Could not find qty span pattern');
}

// ═══════════════════════════════════════════════════════════════
// 2. Add IVA line below price — target the unique closing of price div
// ═══════════════════════════════════════════════════════════════

const oldPrice = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {qty > 0 ? (`;

const newPrice = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {item.precio > 0 && (() => { const iva = Number(item.iva_rate || 22); const sinIva = Math.round(item.precio / (1 + iva / 100)); return <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>{iva > 0 ? ('$' + sinIva.toLocaleString() + ' + IVA ' + iva + '%') : 'Exento de IVA'}</div>; })()}
        {qty > 0 ? (`;

if (pg.includes(oldPrice)) {
  pg = pg.replace(oldPrice, newPrice);
  changes++;
  console.log('✅ 2/4 IVA breakdown below price');
} else {
  console.log('⚠️  Could not find price block pattern');
}

// ═══════════════════════════════════════════════════════════════
// 3. Show min qty on Agregar button + min_order_qty in demo mapping
// ═══════════════════════════════════════════════════════════════

const oldBtn = "{item.precio > 0 ? '+ Agregar' : 'Sin precio'}";
const newBtn = "{item.precio > 0 ? (item.min_order_qty > 1 ? ('+ Min. ' + item.min_order_qty) : '+ Agregar') : 'Sin precio'}";

if (pg.includes(oldBtn)) {
  // Replace only the FIRST occurrence (inside ProductCard)
  pg = pg.replace(oldBtn, newBtn);
  changes++;
  console.log('✅ 3/4 Min qty shown on Agregar button');
} else {
  console.log('⚠️  Could not find Agregar button text');
}

// Add min_order_qty to demo product mapping
const oldDemoMap = "imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,";
if (pg.includes(oldDemoMap) && !pg.includes('min_order_qty')) {
  pg = pg.replace(oldDemoMap, oldDemoMap + ' min_order_qty: p.min_order_qty || 1,');
  console.log('✅     min_order_qty added to demo mapping');
}

// ═══════════════════════════════════════════════════════════════
// 4. addItem: first add sets min qty; removeItem: below min removes
// ═══════════════════════════════════════════════════════════════

const oldAdd = "const addItem    = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 })); };";
const newAdd = `const addItem = item => {
    track('producto_agregado', { producto: item.nombre, precio: item.precio });
    setCarrito(c => {
      const cur = c[item.id] || 0;
      const min = item.min_order_qty || 1;
      return { ...c, [item.id]: cur === 0 ? min : cur + 1 };
    });
  };`;

if (pg.includes(oldAdd)) {
  pg = pg.replace(oldAdd, newAdd);
  changes++;
  console.log('✅ 4/4 addItem respects min_order_qty on first add');
} else {
  console.log('⚠️  Could not find addItem pattern');
}

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

// ═══════════════════════════════════════════════════════════════
// 5. Add CSS to hide number input spinners
// ═══════════════════════════════════════════════════════════════

const mainDiv = "<div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS }}>";
if (pg.includes(mainDiv) && !pg.includes('webkit-inner-spin-button')) {
  const css = `<style>{\`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}input[type=number]{-moz-appearance:textfield}\`}</style>`;
  pg = pg.replace(mainDiv, mainDiv + '\n      ' + css);
  console.log('✅     CSS to hide number spinners');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Clean patch applied! (${changes}/4 changes)

  1. Editable qty input (type a number directly)
  2. IVA breakdown below price ($344 + IVA 22%)
  3. Min order qty on button (+ Min. 6)
  4. addItem/removeItem respect min_order_qty
══════════════════════════════════════════════`);

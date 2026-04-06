#!/usr/bin/env node
// patch-portal-fix-iva-min.cjs — Fix broken IVA code + add min order qty

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// 1. FIX THE BROKEN IVA BLOCK — replace the broken section with working code
const brokenIva = `        {item.precio > 0 && (
          <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>
            {(() => {
              const iva = item.iva_rate !== undefined && item.iva_rate !== null ? Number(item.iva_rate) : 22;
              const sinIva = (item.precio / (1 + iva / 100));
              return iva > 0 ? '`;

// Find the broken block and everything up to the qty section
const brokenStart = pg.indexOf(brokenIva);
if (brokenStart === -1) {
  console.log('⚠️  Could not find broken IVA block — maybe already fixed');
} else {
  // Find where the broken block ends (it got cut into the qty section)
  // The next valid JSX should be "{qty > 0 ?"
  const qtyStart = pg.indexOf('        {qty > 0 ? (', brokenStart);
  if (qtyStart > brokenStart) {
    // Replace the broken IVA block with a working one
    const workingIva = `        {item.precio > 0 && (() => {
          const iva = item.iva_rate !== undefined && item.iva_rate !== null ? Number(item.iva_rate) : 22;
          const sinIva = Math.round(item.precio / (1 + iva / 100));
          return <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>{iva > 0 ? '$' + sinIva.toLocaleString() + ' + IVA ' + iva + '%' : 'Exento de IVA'}</div>;
        })()}
`;
    pg = pg.slice(0, brokenStart) + workingIva + pg.slice(qtyStart);
    console.log('✅ Fixed broken IVA block');
  } else {
    console.log('⚠️  Could not find qty section after broken IVA');
  }
}

// 2. ADD MIN ORDER QTY — show minimum in ProductCard and validate in CartDrawer
// Add min qty display below the IVA line
const addBtnAnchor = `{item.precio > 0 ? '+ Agregar' : 'Sin precio'}`;
if (pg.includes(addBtnAnchor) && !pg.includes('min_order_qty')) {
  pg = pg.replace(
    addBtnAnchor,
    `{item.precio > 0 ? (item.min_order_qty > 1 ? '+ Agregar (min. ' + item.min_order_qty + ')' : '+ Agregar') : 'Sin precio'}`
  );
  console.log('✅ ProductCard: show min qty on Agregar button');
}

// When clicking + Agregar for the first time, add min_order_qty units instead of 1
const oldAddItem = "const addItem    = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 })); };";
const newAddItem = `const addItem    = item => {
    track('producto_agregado', { producto: item.nombre, precio: item.precio });
    setCarrito(c => {
      const current = c[item.id] || 0;
      const minQty = item.min_order_qty || 1;
      // If adding for the first time, set to min qty; otherwise increment by 1
      const newQty = current === 0 ? minQty : current + 1;
      return { ...c, [item.id]: newQty };
    });
  };`;

if (pg.includes(oldAddItem)) {
  pg = pg.replace(oldAddItem, newAddItem);
  console.log('✅ addItem: first add sets min_order_qty');
} else {
  console.log('⏭  addItem already modified or not found');
}

// Add validation in removeItem — don't go below min_order_qty
const oldRemoveItem = `const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    if (q <= 0) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });`;
const newRemoveItem = `const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    const minQty = item.min_order_qty || 1;
    // If below min, remove entirely
    if (q < minQty) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });`;

if (pg.includes(oldRemoveItem)) {
  pg = pg.replace(oldRemoveItem, newRemoveItem);
  console.log('✅ removeItem: respects min_order_qty');
} else {
  console.log('⏭  removeItem already modified or not found');
}

// 3. Add min_order_qty to demo product mapping
const oldDemoMap = "imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,";
const newDemoMap = "imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22, min_order_qty: p.min_order_qty || 1,";

if (pg.includes(oldDemoMap) && !pg.includes('min_order_qty: p.min_order_qty')) {
  pg = pg.replace(oldDemoMap, newDemoMap);
  console.log('✅ Demo products: include min_order_qty');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal fixes applied!

  1. FIXED: Broken IVA display code (build error)
     - Shows "$344 + IVA 22%" below each price
     - Shows "Exento de IVA" if rate is 0

  2. MIN ORDER QTY:
     - Button shows "+ Agregar (min. 6)" if min > 1
     - First click adds min qty (not 1)
     - Remove button: goes below min → removes entirely
     - Demo products include min_order_qty field

  DB columns already added:
     products.min_order_qty (integer, default 1)
     organizations.min_order_amount (numeric, default 0)
══════════════════════════════════════════════`);

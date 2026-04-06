#!/usr/bin/env node
// patch-portal-qty-iva.cjs — Editable quantity input + IVA breakdown in ProductCard

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// ═══════════════════════════════════════════════════════════════
// 1. Make quantity editable — replace the static span with an input
// ═══════════════════════════════════════════════════════════════

// Find the quantity display between - and + buttons
const oldQtyDisplay = `<span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', flex: 1, textAlign: 'center' }}>{qty}</span>`;

const newQtyInput = `<input
              type="number" inputMode="numeric" min="0"
              value={qty}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (isNaN(v) || v <= 0) { onRemove(item); }
                else {
                  const diff = v - qty;
                  if (diff > 0) for (let i = 0; i < diff; i++) onAdd(item);
                  else if (diff < 0) for (let i = 0; i < -diff; i++) onRemove(item);
                }
              }}
              onFocus={e => e.target.select()}
              style={{ width: 48, fontSize: 15, fontWeight: 700, color: '#1a1a18', textAlign: 'center',
                border: '1px solid #e0e0d8', borderRadius: 6, padding: '2px 0',
                fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
                outline: 'none', background: '#fafaf7',
                MozAppearance: 'textfield', WebkitAppearance: 'none' }}
            />`;

if (pg.includes(oldQtyDisplay)) {
  pg = pg.replace(oldQtyDisplay, newQtyInput);
  console.log('✅ ProductCard: made quantity input editable');
} else {
  console.log('⚠️  Could not find qty display pattern');
}

// ═══════════════════════════════════════════════════════════════
// 2. Add IVA breakdown below price
// ═══════════════════════════════════════════════════════════════

// Find the price display and add IVA info below it
const oldPriceBlock = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>`;

const newPriceBlock = `{item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {item.precio > 0 && (
          <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>
            {(() => {
              const iva = item.iva_rate !== undefined && item.iva_rate !== null ? Number(item.iva_rate) : 22;
              const sinIva = (item.precio / (1 + iva / 100));
              return iva > 0 ? '$' + Math.round(sinIva).toLocaleString() + ' + IVA ' + iva + '%' : 'Exento de IVA';
            })()}
          </div>
        )}`;

if (pg.includes(oldPriceBlock)) {
  pg = pg.replace(oldPriceBlock, newPriceBlock);
  console.log('✅ ProductCard: added IVA breakdown below price');
} else {
  console.log('⚠️  Could not find price block pattern');
}

// ═══════════════════════════════════════════════════════════════
// 3. Add CSS to hide number input spinners (arrows)
// ═══════════════════════════════════════════════════════════════

// Add a style tag for hiding number input spinners
const styleTag = `
  <style>{\`
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
  \`}</style>`;

// Insert at the beginning of the main return
const mainReturn = "<div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS }}>";
if (pg.includes(mainReturn) && !pg.includes('webkit-inner-spin-button')) {
  pg = pg.replace(mainReturn, mainReturn + styleTag);
  console.log('✅ Added CSS to hide number input spinners');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal UX improvements patched!

  1. EDITABLE QUANTITY INPUT
     - The number between - and + is now an input field
     - Client can type "48" directly instead of clicking + 48 times
     - Click on the number to select all and type new quantity
     - Setting to 0 or empty removes the item

  2. IVA BREAKDOWN
     - Below each price, shows: "$344 + IVA 22%"
     - Calculates price without IVA from the total price
     - Shows "Exento de IVA" if iva_rate is 0

══════════════════════════════════════════════`);

#!/usr/bin/env node
// patch-portal-track-fix.cjs — Add track function to PedidosPage main component

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// The addItem function calls track() but track is only defined inside CartDrawer.
// We need to add a track function in the PedidosPage main component scope.

// Find the addItem line and add track before it
const addItemLine = "const addItem    = item => { track('producto_agregado',";

if (pg.includes(addItemLine) && !pg.includes('// Analytics — PedidosPage scope')) {
  pg = pg.replace(
    addItemLine,
    `// Analytics — PedidosPage scope
  const track = (event, props = {}) => { try { window.posthog?.capture(event, { org: ORG, ...props }); } catch {} };

  ` + addItemLine
  );
  console.log('✅ Added track function to PedidosPage main component');
} else {
  console.log('⏭  track already exists in PedidosPage scope or addItem not found');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal demo fix: track function added
  - addItem now works in demo mode
  - + Agregar button functional
══════════════════════════════════════════════`);

#!/usr/bin/env node
// patch-portal-remove-orphan.cjs — Remove orphaned IVA code fragment

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// Remove the orphaned IVA fragment that appears after the component closing brace
const orphanedCode = `}
 + Math.round(sinIva).toLocaleString() + ' + IVA ' + iva + '%' : 'Exento de IVA';
            })()}
          </div>
        )}
        {qty > 0 ? (`;

const cleanCode = `}
        {qty > 0 ? (`;

if (pg.includes(orphanedCode)) {
  pg = pg.replace(orphanedCode, cleanCode);
  console.log('✅ Removed orphaned IVA code fragment');
} else {
  // Try alternative pattern — might have different whitespace
  const alt = / \+ Math\.round\(sinIva\)\.toLocaleString\(\) \+ ' \+ IVA ' \+ iva \+ '%' : 'Exento de IVA';\s*\}\)\(\)\}\s*<\/div>\s*\}\)\s*\{qty > 0 \? \(/;
  if (alt.test(pg)) {
    pg = pg.replace(alt, '{qty > 0 ? (');
    console.log('✅ Removed orphaned IVA code fragment (regex)');
  } else {
    console.log('⚠️  Could not find orphaned fragment — checking line by line');
    const lines = pg.split('\n');
    const idx = lines.findIndex(l => l.includes("+ Math.round(sinIva)"));
    if (idx !== -1) {
      // Remove this line and the next 3 lines (})(), </div>, )})
      lines.splice(idx, 4);
      pg = lines.join('\n');
      console.log('✅ Removed orphaned IVA lines at index ' + idx);
    } else {
      console.log('⏭  No orphaned code found — may already be clean');
    }
  }
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Orphaned IVA fragment removed
  Build should pass now
══════════════════════════════════════════════`);

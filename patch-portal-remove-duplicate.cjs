#!/usr/bin/env node
// patch-portal-remove-duplicate.cjs — Remove duplicated ProductCard residual block

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// The problem: patches left a duplicate block of ProductCard JSX floating
// between the end of PedidosPage component "}" and "// ── Historial"
// We need to remove everything between "  );\n}\n" and "// ── Historial" 
// that shouldn't be there

const endOfComponent = '  );\n}\n';
const historialComment = '// ── Historial';

// Find the SECOND occurrence of endOfComponent (the first is CartDrawer or similar)
let firstIdx = pg.indexOf(endOfComponent);
let secondIdx = pg.indexOf(endOfComponent, firstIdx + endOfComponent.length);

// Find the historial comment
const historialIdx = pg.indexOf(historialComment);

if (secondIdx > 0 && historialIdx > secondIdx) {
  // Check if there's junk between the second "}\n" and historial
  const between = pg.slice(secondIdx + endOfComponent.length, historialIdx).trim();
  if (between.length > 0 && between.includes('{qty > 0')) {
    // Remove the junk
    pg = pg.slice(0, secondIdx + endOfComponent.length) + '\n' + pg.slice(historialIdx);
    console.log('✅ Removed orphaned duplicate block (' + between.length + ' chars)');
  } else {
    console.log('⏭  No orphaned block found between component end and Historial');
  }
} else {
  // Alternative: find the pattern directly
  // Look for the closing brace of PedidosPage followed by orphaned JSX
  const pattern = /\};\n\}\n\s*\{qty > 0[\s\S]*?\{item\.precio > 0 \? '\+ Agregar' : 'Sin precio'\}[\s\S]*?\);\n\}\n/;
  if (pattern.test(pg)) {
    pg = pg.replace(pattern, ');\n}\n\n');
    console.log('✅ Removed orphaned duplicate block (regex)');
  } else {
    // Last resort: find by line numbers
    const lines = pg.split('\n');
    // Find line with just "}" followed by "        {qty > 0 ? ("
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim() === '}' && lines[i+1].includes('{qty > 0 ? (')) {
        // Find the end of this orphaned block — next "}" + "// ── Historial"
        let endLine = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].includes('// ── Historial')) {
            endLine = j;
            break;
          }
        }
        if (endLine > i) {
          // Remove lines from i+1 to endLine-1
          lines.splice(i + 1, endLine - i - 1);
          pg = lines.join('\n');
          console.log('✅ Removed orphaned lines ' + (i+2) + ' to ' + endLine);
          break;
        }
      }
    }
  }
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Duplicate block removed — build should pass
══════════════════════════════════════════════`);

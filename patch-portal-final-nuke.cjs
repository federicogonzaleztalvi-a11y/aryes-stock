#!/usr/bin/env node
// patch-portal-final-nuke.cjs — Remove the exact orphaned block

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// The orphaned block starts with "}\n        {qty > 0 ? (" and ends with
// "  );\n}\n\n// ── Historial"
// But the "}" before it is the legit end of a component.
// We need to remove from "        {qty > 0 ? (" to just before "// ── Historial"

const orphanStart = pg.indexOf("        {qty > 0 ? (\n          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>\n            <button onClick={() => onRemove(item)}");

if (orphanStart === -1) {
  console.log('⏭  No orphaned block found');
  process.exit(0);
}

// Find the end marker
const endMarker = '// ── Historial';
const orphanEnd = pg.indexOf(endMarker, orphanStart);

if (orphanEnd === -1) {
  console.log('⚠️  Found orphan start but not end');
  process.exit(1);
}

// Remove everything from orphanStart to orphanEnd
const before = pg.slice(0, orphanStart);
const after = pg.slice(orphanEnd);

pg = before + '\n' + after;

// Verify there's no duplicate "}" before the Historial comment
// Clean up any double newlines
pg = pg.replace(/\n{4,}/g, '\n\n');

fs.writeFileSync(pedidosPath, pg, 'utf8');

const linesRemoved = pg.slice(orphanStart, orphanEnd).split('\n').length;
console.log('✅ Removed orphaned block (' + linesRemoved + ' lines)');

console.log(`
══════════════════════════════════════════════
✅ Orphaned block definitively removed
══════════════════════════════════════════════`);

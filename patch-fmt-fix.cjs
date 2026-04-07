const fs = require('fs');
let src = fs.readFileSync('src/tabs/FacturacionTab.jsx', 'utf8');

// Add fmt object after the imports
const ANCHOR = "import { G, F, CFE_TIPOS, CFE_STATUS, COND_PAGO, newId, fmtMoney, fmtDateShort, daysUntil, agingBucket } from './facturacion/constants.js';";
const FIX = ANCHOR + "\nconst fmt = { currency: fmtMoney };";

if (src.includes(ANCHOR) && !src.includes('const fmt = { currency: fmtMoney }')) {
  src = src.replace(ANCHOR, FIX);
  fs.writeFileSync('src/tabs/FacturacionTab.jsx', src);
  console.log('✅ Added fmt.currency alias for fmtMoney');
} else {
  console.log('⏭  Already exists or anchor not found');
}

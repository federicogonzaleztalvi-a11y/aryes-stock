const fs = require('fs');
let src = fs.readFileSync('src/tabs/facturacion/ModalFactura.jsx', 'utf8');

const ANCHOR = "import { G, F, COND_PAGO, CFE_TIPOS, MONEDAS, today, addDays, fmtMoney } from './constants.js';";
const FIX = ANCHOR + "\nconst fmt = { currency: fmtMoney };";

if (src.includes(ANCHOR) && !src.includes('const fmt = { currency: fmtMoney }')) {
  src = src.replace(ANCHOR, FIX);
  fs.writeFileSync('src/tabs/facturacion/ModalFactura.jsx', src);
  console.log('✅ Added fmt.currency alias in ModalFactura');
} else {
  console.log('⏭  Already exists or anchor not found');
}

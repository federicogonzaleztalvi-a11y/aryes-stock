#!/usr/bin/env node
// patch-legal-pages.cjs — Add Terms and Privacy pages + routes + links

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/main.jsx');
let main = fs.readFileSync(mainPath, 'utf8');

// 1. Add lazy imports
const importAnchor = "const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));";
const legalImports = `
const TermsPage   = lazy(() => import('./pages/TermsPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'));`;

if (!main.includes('TermsPage')) {
  main = main.replace(importAnchor, importAnchor + legalImports);
  console.log('✅ Added TermsPage + PrivacyPage lazy imports');
} else {
  console.log('⏭  Legal page imports already exist');
}

// 2. Add routes
const routeAnchor = '<Route path="/reset-password"';
const legalRoutes = `<Route path="/terms" element={<Suspense fallback={<div/>}><TermsPage /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<div/>}><PrivacyPage /></Suspense>} />
          `;

if (!main.includes('path="/terms"')) {
  main = main.replace(routeAnchor, legalRoutes + routeAnchor);
  console.log('✅ Added /terms and /privacy routes');
} else {
  console.log('⏭  Legal routes already exist');
}

fs.writeFileSync(mainPath, main, 'utf8');

// 3. Update RegisterPage to link to real pages instead of #
const regPath = path.join(process.cwd(), 'src/pages/RegisterPage.jsx');
let reg = fs.readFileSync(regPath, 'utf8');

if (reg.includes('href="#"')) {
  reg = reg.replace(
    '<a href="#" style={{ color: \'#9a9a98\' }}>términos de servicio</a>',
    '<a href="/terms" style={{ color: \'#9a9a98\' }}>términos de servicio</a>'
  );
  reg = reg.replace(
    '<a href="#" style={{ color: \'#9a9a98\' }}>política de privacidad</a>',
    '<a href="/privacy" style={{ color: \'#9a9a98\' }}>política de privacidad</a>'
  );
  fs.writeFileSync(regPath, reg, 'utf8');
  console.log('✅ Updated RegisterPage links to /terms and /privacy');
} else {
  console.log('⏭  RegisterPage links already updated');
}

console.log(`
══════════════════════════════════════════════
✅ Legal pages patched!
  /terms → Términos de Servicio
  /privacy → Política de Privacidad
  RegisterPage links updated
══════════════════════════════════════════════`);

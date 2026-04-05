#!/usr/bin/env node
// patch-reset-password.cjs
// Adds "forgot password" link to LoginScreen and route for ResetPasswordPage

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/main.jsx');
let main = fs.readFileSync(mainPath, 'utf8');

// 1. Add lazy import for ResetPasswordPage
const importAnchor = "const TrackingPage     = lazy(() => import('./pages/TrackingPage.jsx'));";
const resetImport = "\nconst ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));";

if (!main.includes('ResetPasswordPage')) {
  main = main.replace(importAnchor, importAnchor + resetImport);
  console.log('✅ Added ResetPasswordPage lazy import');
} else {
  console.log('⏭  ResetPasswordPage import already exists');
}

// 2. Add route for /reset-password
const routeAnchor = '<Route path="/register" element={<RegisterPage />} />';
const resetRoute = '\n          <Route path="/reset-password" element={<Suspense fallback={<div/>}><ResetPasswordPage /></Suspense>} />';

if (!main.includes('reset-password')) {
  main = main.replace(routeAnchor, routeAnchor + resetRoute);
  console.log('✅ Added /reset-password route');
} else {
  console.log('⏭  /reset-password route already exists');
}

// 3. Add "forgot password" link in LoginScreen
const forgotAnchor = `¿No tenés cuenta?`;
const forgotLink = `¿Olvidaste tu contraseña?{' '}
            <a href="/reset-password" style={{ color: '#1a8a3c', fontWeight: 600, textDecoration: 'none' }}>Recuperar</a>
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 4 }}>
            ¿No tenés cuenta?`;

if (!main.includes('Olvidaste tu contraseña')) {
  main = main.replace(forgotAnchor, forgotLink);
  console.log('✅ Added "forgot password" link to LoginScreen');
} else {
  console.log('⏭  "forgot password" link already exists');
}

fs.writeFileSync(mainPath, main, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Reset password flow patched!
  - /reset-password → request reset email
  - /reset-password#access_token=... → set new password
  - Login screen has "¿Olvidaste tu contraseña?" link
══════════════════════════════════════════════`);

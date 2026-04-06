#!/usr/bin/env node
// patch-forgot-text.cjs — Simplify forgot password to a single link

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/main.jsx');
let main = fs.readFileSync(mainPath, 'utf8');

// Replace the two-part "¿Olvidaste tu contraseña? Recuperar" with a single link
const oldText = `¿Olvidaste tu contraseña?{' '}
            <a href="/reset-password" style={{ color: '#1a8a3c', fontWeight: 600, textDecoration: 'none' }}>Recuperar</a>
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 4 }}>
            ¿No tenés cuenta?`;

const newText = `<a href="/reset-password" style={{ color: '#6a6a68', textDecoration: 'none' }}>¿Olvidaste tu contraseña?</a>
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 4 }}>
            ¿No tenés cuenta?`;

if (main.includes('Recuperar</a>')) {
  main = main.replace(oldText, newText);
  console.log('✅ Simplified forgot password to single link');
} else {
  console.log('⚠️  Could not find text to replace');
}

fs.writeFileSync(mainPath, main, 'utf8');

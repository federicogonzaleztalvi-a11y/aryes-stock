#!/usr/bin/env node
// patch-forgot-style.cjs — Make forgot password bold green + fix spacing

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/main.jsx');
let main = fs.readFileSync(mainPath, 'utf8');

// Find and replace the forgot password line
const oldForgot = `<a href="/reset-password" style={{ color: '#6a6a68', textDecoration: 'none' }}>¿Olvidaste tu contraseña?</a>
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 4 }}>`;

const newForgot = `<a href="/reset-password" style={{ color: '#1a8a3c', fontWeight: 600, textDecoration: 'none' }}>¿Olvidaste tu contraseña?</a>
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 8 }}>`;

if (main.includes("color: '#6a6a68', textDecoration: 'none' }}>¿Olvidaste")) {
  main = main.replace(oldForgot, newForgot);
  console.log('✅ Forgot password: bold green + spacing fixed');
} else {
  console.log('⚠️  Could not find forgot password text to patch');
}

fs.writeFileSync(mainPath, main, 'utf8');

#!/usr/bin/env node
// patch-empty-states-legal.cjs — Improve empty states + add legal links to landing footer

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 1. LANDING FOOTER — Add legal links + update email to .com
// ═══════════════════════════════════════════════════════════════

const landingPath = path.join(process.cwd(), 'src/pages/LandingPage.jsx');
let landing = fs.readFileSync(landingPath, 'utf8');

// Add legal links row in footer bottom bar
const oldBottomBar = `<span>© 2026 Aryes</span>`;
const newBottomBar = `<span>© 2026 Aryes</span>
            <span style={{ margin: '0 8px', color: '#d0d0cc' }}>·</span>
            <a href="/terms" style={{ color: '#b0b0ac', textDecoration: 'none' }}>Términos</a>
            <span style={{ margin: '0 8px', color: '#d0d0cc' }}>·</span>
            <a href="/privacy" style={{ color: '#b0b0ac', textDecoration: 'none' }}>Privacidad</a>`;

if (!landing.includes('href="/terms"')) {
  landing = landing.replace(oldBottomBar, newBottomBar);
  console.log('✅ Landing footer: added legal links');
} else {
  console.log('⏭  Landing footer: legal links already exist');
}

// Update email from .com.uy to .com
if (landing.includes('aryes.com.uy')) {
  landing = landing.replace(/aryes\.com\.uy/g, 'aryes.com');
  console.log('✅ Landing: updated email to aryes.com');
} else {
  console.log('⏭  Landing: email already .com');
}

fs.writeFileSync(landingPath, landing, 'utf8');

// ═══════════════════════════════════════════════════════════════
// 2. EMPTY STATES — Fix tabs that only say "No hay X"
// ═══════════════════════════════════════════════════════════════

const fixes = [
  {
    file: 'src/tabs/BatchPickingTab.jsx',
    old: `No hay ordenes pendientes</div>`,
    new: `No hay órdenes pendientes de picking</div>`,
  },
  {
    file: 'src/tabs/TransferenciasTab.jsx',
    old: `>No hay transferencias registradas</div>`,
    new: `><div style={{fontSize:40,marginBottom:8}}>📦</div>No hay transferencias registradas<div style={{fontSize:12,marginTop:6,color:"#9a9a98"}}>Las transferencias se crean cuando movés stock entre depósitos</div></div>`,
  },
  {
    file: 'src/tabs/InformesTab.jsx',
    old: `>No hay ordenes de venta aun</div>`,
    new: `><div style={{fontSize:40,marginBottom:8}}>📊</div>No hay órdenes de venta aún<div style={{fontSize:12,marginTop:6,color:"#9a9a98"}}>Creá tu primera venta para ver reportes e informes</div></div>`,
  },
  {
    file: 'src/tabs/PackingTab.jsx',
    old: `>No hay ordenes pendientes de packing</div>`,
    new: `><div style={{fontSize:40,marginBottom:8}}>✅</div>No hay órdenes pendientes de packing<div style={{fontSize:12,marginTop:6}}>Cuando confirmes ventas aparecerán acá para preparar</div></div>`,
  },
  {
    file: 'src/tabs/KPIsTab.jsx',
    old: `>Sin ventas registradas</div>`,
    new: `><div style={{fontSize:40,marginBottom:8}}>📈</div>Sin ventas registradas<div style={{fontSize:12,marginTop:6,color:"#9a9a98"}}>Los KPIs se calculan automáticamente con cada venta</div></div>`,
  },
  {
    file: 'src/tabs/UsersTab.jsx',
    old: `>No hay usuarios cargados aún</p>`,
    new: `>No hay usuarios cargados aún</p><p style={{ color: '#9a9a98', fontSize: 13 }}>Agregá operadores y vendedores desde el botón de arriba</p>`,
  },
  {
    file: 'src/tabs/MovimientosTab.jsx',
    old: `'Todavia no hay movimientos registrados'`,
    new: `'Todavía no hay movimientos registrados. Se generan automáticamente con cada venta y recepción.'`,
  },
  {
    file: 'src/tabs/LotesTab.jsx',
    old: `'No hay lotes registrados todavia'`,
    new: `'No hay lotes registrados todavía. Los lotes se crean al recibir mercadería.'`,
  },
];

let fixCount = 0;
for (const fix of fixes) {
  const filePath = path.join(process.cwd(), fix.file);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭  ${fix.file}: file not found`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(fix.old)) {
    content = content.replace(fix.old, fix.new);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${fix.file}: improved empty state`);
    fixCount++;
  } else {
    console.log(`⏭  ${fix.file}: pattern not found or already fixed`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. Update RegisterPage email too
// ═══════════════════════════════════════════════════════════════
const regPath = path.join(process.cwd(), 'src/pages/RegisterPage.jsx');
if (fs.existsSync(regPath)) {
  let reg = fs.readFileSync(regPath, 'utf8');
  if (reg.includes('aryes.com.uy')) {
    reg = reg.replace(/aryes\.com\.uy/g, 'aryes.com');
    fs.writeFileSync(regPath, reg, 'utf8');
    console.log('✅ RegisterPage: updated email to aryes.com');
  }
}

// Update UpgradePage email too
const upgPath = path.join(process.cwd(), 'src/pages/UpgradePage.jsx');
if (fs.existsSync(upgPath)) {
  let upg = fs.readFileSync(upgPath, 'utf8');
  if (upg.includes('aryes.com.uy')) {
    upg = upg.replace(/aryes\.com\.uy/g, 'aryes.com');
    fs.writeFileSync(upgPath, upg, 'utf8');
    console.log('✅ UpgradePage: updated email to aryes.com');
  }
}

console.log(`
══════════════════════════════════════════════
✅ Empty states + legal links patched!
  - Landing footer: Términos · Privacidad links
  - Email updated to aryes.com across all pages
  - ${fixCount} empty states improved with guidance text
══════════════════════════════════════════════`);

// fix-sw-versioning.cjs
// Fix M1: SW cache versioning — inyecta timestamp de build en CACHE_NAME
// para que cada deploy invalide el cache anterior automáticamente.
//
// Uso: cd ~/Downloads/aryes-stock && node fix-sw-versioning.cjs

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, 'public', 'sw.js');
const src = fs.readFileSync(swPath, 'utf8');

const oldPattern = "const CACHE_NAME = 'pazque-' + '20260409';";
const idx = src.indexOf(oldPattern);

if (idx === -1) {
  // Maybe already patched or different format — try regex
  const regex = /const CACHE_NAME = 'pazque-' \+ '\d{8}';/;
  if (regex.test(src)) {
    const updated = src.replace(regex, "const CACHE_NAME = 'pazque-' + BUILD_VERSION;");
    fs.writeFileSync(swPath, updated, 'utf8');
    console.log('✅ sw.js — CACHE_NAME actualizado (regex)');
  } else {
    console.error('❌ Patrón no encontrado en sw.js — verificá manualmente');
    process.exit(1);
  }
} else {
  const updated = src.slice(0, idx) +
    "const CACHE_NAME = 'pazque-' + BUILD_VERSION;" +
    src.slice(idx + oldPattern.length);
  fs.writeFileSync(swPath, updated, 'utf8');
  console.log('✅ sw.js — CACHE_NAME usa BUILD_VERSION');
}

// Ahora agregar el script de inyección en vite.config
// Agrega un plugin que escribe BUILD_VERSION en sw.js durante el build
const vitePath = path.join(__dirname, 'vite.config.js');
const viteSrc = fs.readFileSync(vitePath, 'utf8');

if (viteSrc.includes('sw-version')) {
  console.log('⏭️  vite.config.js — plugin sw-version ya existe');
} else {
  // Inject plugin into the plugins array
  const pluginCode = `
    // SW cache versioning — inject build timestamp
    {
      name: 'sw-version',
      closeBundle() {
        const fs = require('fs');
        const swFile = 'dist/sw.js';
        if (fs.existsSync(swFile)) {
          const v = Date.now().toString(36);
          let sw = fs.readFileSync(swFile, 'utf8');
          sw = sw.replace('BUILD_VERSION', "'" + v + "'");
          fs.writeFileSync(swFile, sw, 'utf8');
          console.log('  SW version injected:', v);
        }
      },
    },`;

  // Find plugins: [ and insert after it
  const pluginsIdx = viteSrc.indexOf('plugins: [');
  if (pluginsIdx === -1) {
    // Try plugins:[ without space
    const alt = viteSrc.indexOf('plugins:[');
    if (alt === -1) {
      console.error('❌ No encontré plugins: [ en vite.config.js — agregá el plugin manualmente');
      process.exit(1);
    }
    const insertAt = alt + 'plugins:['.length;
    const updated = viteSrc.slice(0, insertAt) + pluginCode + viteSrc.slice(insertAt);
    fs.writeFileSync(vitePath, updated, 'utf8');
    console.log('✅ vite.config.js — plugin sw-version agregado');
  } else {
    const insertAt = pluginsIdx + 'plugins: ['.length;
    const updated = viteSrc.slice(0, insertAt) + pluginCode + viteSrc.slice(insertAt);
    fs.writeFileSync(vitePath, updated, 'utf8');
    console.log('✅ vite.config.js — plugin sw-version agregado');
  }
}

// Copy sw.js to dist during build — Vite doesn't copy public/ to dist automatically? 
// Actually Vite DOES copy public/ to dist. So sw.js will be there. Good.

console.log('\n🏁 Listo. El SW ahora genera un CACHE_NAME único en cada build.');
console.log('   Verificá con: npm run build');

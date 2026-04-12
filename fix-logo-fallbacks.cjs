// fix-logo-fallbacks.cjs
// Aplica 3 fixes de logo:
// 1. AppSidebar.jsx — fallback de pazque-logo → inicial de empresa
// 2. FacturaPDF.jsx — agregar objectFit + onError
// 3. RemitoPDF.jsx  — agregar objectFit + onError
//
// Uso: cd ~/Downloads/aryes-stock && node fix-logo-fallbacks.cjs

const fs = require('fs');
const path = require('path');

function patch(file, oldStr, newStr) {
  const full = path.join(__dirname, file);
  if (!fs.existsSync(full)) {
    console.error(`❌ No encontrado: ${file}`);
    return false;
  }
  const src = fs.readFileSync(full, 'utf8');
  const idx = src.indexOf(oldStr);
  if (idx === -1) {
    console.error(`❌ Patrón no encontrado en ${file} — ya fue aplicado o cambió el código`);
    console.error(`   Buscando: ${oldStr.slice(0, 80)}...`);
    return false;
  }
  if (src.indexOf(oldStr, idx + 1) !== -1) {
    console.error(`⚠️  Patrón duplicado en ${file} — aplicando solo la primera ocurrencia`);
  }
  const out = src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
  fs.writeFileSync(full, out, 'utf8');
  console.log(`✅ ${file} — parcheado`);
  return true;
}

// ── 1. AppSidebar.jsx — reemplazar bloque logo completo ──────────────────────

patch(
  'src/components/AppSidebar.jsx',

  `        {brandCfg?.logoUrl ? (
          <img
            src={brandCfg.logoUrl}
            alt={brandName || 'Logo'}
            style={{ height: 36, objectFit: 'contain', maxWidth: '100%', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <img
            src="/pazque-logo.png"
            alt="Pazque"
            style={{ height: 36, objectFit: 'contain', maxWidth: '100%', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}`,

  `        {brandCfg?.logoUrl ? (
          <img
            src={brandCfg.logoUrl}
            alt={brandName || 'Logo'}
            style={{ height: 36, objectFit: 'contain', maxWidth: '100%', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : brandName ? (
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: brandColor + '18',
            color: brandColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, fontFamily: S.sans,
            flexShrink: 0,
          }}>
            {brandName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div style={{
            height: 36, display: 'flex', alignItems: 'center',
            fontSize: 11, color: S.textXs, fontFamily: S.sans,
          }}>
            Configurá tu logo en Ajustes
          </div>
        )}`
);

// ── 2. FacturaPDF.jsx — agregar objectFit + maxWidth + onError ───────────────

patch(
  'src/components/FacturaPDF.jsx',

  `{brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height:48, marginBottom:8, display:'block' }} />`,

  `{brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height:48, objectFit:'contain', maxWidth:'180px', marginBottom:8, display:'block' }} onError={e => e.target.style.display='none'} />`
);

// ── 3. RemitoPDF.jsx — agregar objectFit + maxWidth + onError ────────────────

patch(
  'src/components/RemitoPDF.jsx',

  `{brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height: 48, marginBottom: 8, display: 'block' }} />`,

  `{brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height: 48, objectFit:'contain', maxWidth:'180px', marginBottom: 8, display: 'block' }} onError={e => e.target.style.display='none'} />`
);

console.log('\n🏁 Listo. Verificá con: npm run build');

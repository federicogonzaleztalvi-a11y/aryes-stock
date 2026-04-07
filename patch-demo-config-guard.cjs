// patch-demo-config-guard.cjs
// Adds isDemoMode guard to app_config fetch (emailcfg/brandcfg)
// This fetch crashes in demo mode because db.get() has no real session

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'context', 'AppContext.tsx');

let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════════
// 1. app_config fetch — add isDemoMode guard
// ═══════════════════════════════════════════════════════════════════════

const CONFIG_ANCHOR = `  useEffect(() => {
    if (session?.role !== 'admin') return;
    (async () => {
      try {
        const rows = await db.get`;

const CONFIG_FIX = `  useEffect(() => {
    if (session?.role !== 'admin' || isDemoMode) return;
    (async () => {
      try {
        const rows = await db.get`;

if (src.includes(CONFIG_ANCHOR)) {
  src = src.replace(CONFIG_ANCHOR, CONFIG_FIX);
  changes++;
  console.log('✅ 1/1 app_config fetch: added isDemoMode guard');
} else {
  console.log('❌ 1/1 Could not find app_config anchor (may already be patched)');
}

// ═══════════════════════════════════════════════════════════════════════
// Write
// ═══════════════════════════════════════════════════════════════════════

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`
══════════════════════════════════════════════
✅ App config demo guard patched!

  Fixed: app_config fetch (emailcfg/brandcfg) now skipped in demo mode
  Brand config is already set by demoState useEffect (line 101)
══════════════════════════════════════════════`);
} else {
  console.log('\n⚠️  No changes made');
}

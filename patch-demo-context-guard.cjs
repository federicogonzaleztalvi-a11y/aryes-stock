// patch-demo-context-guard.cjs
// Adds isDemoMode guards to 2 useEffect blocks in AppContext.tsx
// that try to fetch from Supabase and crash because demo has no real session
// ZERO changes to production logic — only adds early returns when isDemoMode

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'context', 'AppContext.tsx');

let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════════
// 1. Batch fetch useEffect — add isDemoMode guard
//    Currently: if (!session) return;
//    Need:      if (!session || isDemoMode) return;
// ═══════════════════════════════════════════════════════════════════════

const BATCH_ANCHOR = `  useEffect(() => {
    if (!session) return;
    setSyncStatus('sync');`;

const BATCH_FIX = `  useEffect(() => {
    if (!session || isDemoMode) return;
    setSyncStatus('sync');`;

if (src.includes(BATCH_ANCHOR)) {
  src = src.replace(BATCH_ANCHOR, BATCH_FIX);
  changes++;
  console.log('✅ 1/2 Batch fetch: added isDemoMode guard');
} else if (src.includes('if (!session || isDemoMode) return;\n    setSyncStatus')) {
  console.log('⏭  1/2 Batch fetch guard already exists');
} else {
  console.log('❌ 1/2 Could not find batch fetch anchor');
}

// ═══════════════════════════════════════════════════════════════════════
// 2. Multi-device sync useEffect — add isDemoMode guard
//    Currently: if (!session || !dbReady) return;
//    Need:      if (!session || !dbReady || isDemoMode) return;
// ═══════════════════════════════════════════════════════════════════════

const SYNC_ANCHOR = `    if (!session || !dbReady) return;
    const syncFromServer`;

const SYNC_FIX = `    if (!session || !dbReady || isDemoMode) return;
    const syncFromServer`;

if (src.includes(SYNC_ANCHOR)) {
  src = src.replace(SYNC_ANCHOR, SYNC_FIX);
  changes++;
  console.log('✅ 2/2 Multi-device sync: added isDemoMode guard');
} else if (src.includes('!dbReady || isDemoMode) return;\n    const syncFromServer')) {
  console.log('⏭  2/2 Sync guard already exists');
} else {
  console.log('❌ 2/2 Could not find sync anchor');
}

// ═══════════════════════════════════════════════════════════════════════
// Write
// ═══════════════════════════════════════════════════════════════════════

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`
══════════════════════════════════════════════
✅ AppContext demo guards patched! (${changes} changes)

  Fixed: demo mode no longer triggers Supabase fetches
  - Batch fetch (products, suppliers, users, orders, plans): SKIPPED
  - Multi-device sync poll (every 30s): SKIPPED
  - Demo data loads via the existing demoState useEffect (unchanged)

  Production: ZERO changes — guards only activate when isDemoMode=true
══════════════════════════════════════════════`);
} else {
  console.log('\n⚠️  No changes made');
}

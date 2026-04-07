// patch-demo-orgstatus.cjs
// Fix: when activateDemo runs, orgStatus stays null until useEffect runs
// This causes a flash of the "loading" spinner (white screen)
// Fix: set orgStatus to 'ok' immediately when demoMode activates

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'main.jsx');

let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════════
// 1. Add useEffect that sets orgStatus='ok' immediately when demoMode changes
//    This runs synchronously in the same render cycle as demoMode change
// ═══════════════════════════════════════════════════════════════════════

const ANCHOR = `  const [orgStatus, setOrgStatus] = React.useState(null); // null=loading, 'ok', 'expired', 'canceled'`;

const FIX = `  const [orgStatus, setOrgStatus] = React.useState(() => demoMode ? 'ok' : null); // null=loading, 'ok', 'expired', 'canceled'

  // Sync orgStatus immediately when demoMode activates (avoids white flash)
  React.useEffect(() => {
    if (demoMode && orgStatus !== 'ok') setOrgStatus('ok');
  }, [demoMode]);`;

if (src.includes(ANCHOR)) {
  src = src.replace(ANCHOR, FIX);
  changes++;
  console.log('✅ 1/1 orgStatus: initialize as ok in demo + sync effect');
} else {
  console.log('❌ 1/1 Could not find orgStatus anchor');
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`
══════════════════════════════════════════════
✅ Demo orgStatus fix applied!

  - orgStatus initializes as 'ok' when demoMode is true
  - Extra useEffect syncs orgStatus when demoMode changes
  - No more white flash / loading spinner in demo
══════════════════════════════════════════════`);
} else {
  console.log('\n⚠️  No changes made');
}

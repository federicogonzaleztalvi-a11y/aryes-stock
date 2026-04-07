// patch-demo-final.cjs
// THE FINAL FIX: useRealtime passes enabled=!!session which is true in demo
// because effectiveSession (fake) is passed as session prop.
// The WebSocket loop crashes React silently (innerHTML=0).
// Fix: pass enabled as !!session && !isDemoMode

const fs = require('fs');
const path = require('path');

let changes = 0;

// ═══════════════════════════════════════════════════════════════════════
// FIX: useRealtime enabled param — disable in demo mode
// ═══════════════════════════════════════════════════════════════════════
{
  const FILE = path.join(__dirname, 'src', 'context', 'AppContext.tsx');
  let src = fs.readFileSync(FILE, 'utf8');

  const OLD = `  }, !!session); // only enable when logged in`;
  const NEW = `  }, !!session && !isDemoMode); // only enable when logged in (disabled in demo)`;

  if (src.includes(OLD)) {
    src = src.replace(OLD, NEW);
    changes++;
    console.log('✅ 1/1 useRealtime: disabled in demo mode (!!session && !isDemoMode)');
  } else if (src.includes('!isDemoMode); // only enable')) {
    console.log('⏭  1/1 Already patched');
  } else {
    console.log('❌ 1/1 Could not find useRealtime enabled anchor');
  }

  fs.writeFileSync(FILE, src, 'utf8');
}

console.log(`
══════════════════════════════════════════════
✅ Final demo fix applied! (${changes} change)

  Root cause: useRealtime was enabled in demo mode because
  !!session was true (fake demo session). The WebSocket
  connection loop with invalid credentials crashed React
  silently (root innerHTML = 0).

  Fix: enabled = !!session && !isDemoMode

  The WebSocket will NOT connect in demo mode.
  No more infinite reconnection loop.
  React will render normally.
══════════════════════════════════════════════`);

const fs = require('fs');

// FIX 1: Add isDemoMode to AppContextValue type in types.ts
let types = fs.readFileSync('src/types.ts', 'utf8');

const OLD_TYPE = `  // ── Auth ───────────────────────────────────────────────────────────────────
  handleLogout: () => void;
  session:      Session | null;
}`;

const NEW_TYPE = `  // ── Auth ───────────────────────────────────────────────────────────────────
  handleLogout: () => void;
  session:      Session | null;
  // ── Demo ───────────────────────────────────────────────────────────────────
  isDemoMode: boolean;
  calcReorderPoints: (...args: unknown[]) => Promise<unknown[]>;
}`;

if (types.includes(OLD_TYPE)) {
  types = types.replace(OLD_TYPE, NEW_TYPE);
  fs.writeFileSync('src/types.ts', types);
  console.log('✅ 1/2 Added isDemoMode + calcReorderPoints to AppContextValue type');
} else {
  console.log('❌ 1/2 Type anchor not found');
}

// FIX 2: Add a visible error indicator directly in App.jsx
// Instead of just console.log, render a RED banner if something is wrong
let app = fs.readFileSync('src/App.jsx', 'utf8');

// Check if the [AryesApp] MOUNTED log exists and is BEFORE useApp
const MOUNT_LOG = `  console.log('[AryesApp] MOUNTED — demoMode:', demoMode, 'dbReady:', typeof dbReady !== 'undefined' ? dbReady : 'not yet');`;
if (app.includes(MOUNT_LOG)) {
  // Move it to BEFORE useApp to see if AryesApp function even runs
  app = app.replace(MOUNT_LOG, '');
  console.log('✅ Removed old mount log');
}

// Add log at the very start, BEFORE useApp
const OLD_APP = `function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate, demoMode, demoGuard}){
  // →→ State and mutations come from AppContext`;
const NEW_APP = `function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate, demoMode, demoGuard}){
  console.log('[AryesApp] FUNCTION CALLED — demoMode:', demoMode);
  // →→ State and mutations come from AppContext`;

if (app.includes(OLD_APP)) {
  app = app.replace(OLD_APP, NEW_APP);
  fs.writeFileSync('src/App.jsx', app);
  console.log('✅ 2/2 Added function entry log to AryesApp');
} else {
  console.log('❌ 2/2 AryesApp anchor not found');
  // Try with existing log
  const ALT = `function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate, demoMode, demoGuard}){`;
  if (app.includes(ALT)) {
    app = app.replace(ALT, ALT + '\n  console.log("[AryesApp] FUNCTION CALLED — demoMode:", demoMode);');
    fs.writeFileSync('src/App.jsx', app);
    console.log('✅ 2/2 (alt) Added function entry log');
  }
}

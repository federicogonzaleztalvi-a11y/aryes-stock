const fs = require('fs');
let src = fs.readFileSync('src/main.jsx', 'utf8');

// Add a visible div RIGHT at the beginning of Root's return
// This will prove if Root renders at all
const OLD = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => { activateDemo(id); setShowDemoSelector(false); }} />;
  }
  if (!effectiveSession) return <LoginScreen onLogin={handleLogin} onExplore={() => setShowDemoSelector(true)} />;`;

const NEW = `  // TEMPORARY DEBUG: visible marker
  console.log('[ROOT RENDER]', { demoMode, hasEffSession: !!effectiveSession, orgStatus, dbg_path: window.location.pathname });

  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => { activateDemo(id); setShowDemoSelector(false); }} />;
  }
  if (!effectiveSession) return <LoginScreen onLogin={handleLogin} onExplore={() => setShowDemoSelector(true)} />;`;

if (src.includes(OLD)) {
  src = src.replace(OLD, NEW);
  fs.writeFileSync('src/main.jsx', src);
  console.log('✅ Debug marker added');
} else {
  console.log('❌ Anchor not found');
}

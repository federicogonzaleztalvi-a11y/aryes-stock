const fs = require('fs');

// FIX 1: DemoSelector onSelect calls activateDemo which triggers re-renders
// Each re-render of Root re-creates DemoSelector because showDemoSelector
// becomes false AFTER demoMode becomes true — but the render order matters.
// The fix: don't re-render DemoSelector at all — hide it IMMEDIATELY

let main = fs.readFileSync('src/main.jsx', 'utf8');

// The issue: activateDemo is called, then setShowDemoSelector(false)
// But React batches these, and the selector might re-render before hiding
// FIX: Add a ref to prevent multiple activateDemo calls
const OLD_SELECTOR = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => { activateDemo(id); setShowDemoSelector(false); }} />;
  }`;

const NEW_SELECTOR = `  const demoActivatingRef = React.useRef(false);
  if (showDemoSelector && !demoMode && !demoActivatingRef.current) {
    return <DemoSelector onSelect={(id) => {
      if (demoActivatingRef.current) return;
      demoActivatingRef.current = true;
      activateDemo(id);
      setShowDemoSelector(false);
    }} />;
  }`;

if (main.includes(OLD_SELECTOR)) {
  main = main.replace(OLD_SELECTOR, NEW_SELECTOR);
  console.log('✅ 1/1 DemoSelector: prevented multiple activateDemo calls');
} else {
  console.log('❌ Anchor not found');
}

fs.writeFileSync('src/main.jsx', main);

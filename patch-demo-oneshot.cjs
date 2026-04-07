const fs = require('fs');

// The REAL problem: when activateDemo runs, it sets 3 state variables
// (demoMode, demoData, demoIndustry). Each triggers a re-render.
// During those re-renders, the condition `showDemoSelector && !demoMode`
// can still be true in intermediate renders, showing DemoSelector again.
// The demoActivatingRef didn't fully solve it.
//
// NUCLEAR FIX: Change the DemoSelector callback in main.jsx to
// use a completely different approach - set showDemoSelector=false FIRST
// in the same setState batch, and use a timeout for activateDemo

let main = fs.readFileSync('src/main.jsx', 'utf8');

// Remove the old ref-based approach and use simpler logic
const OLD = `  const demoActivatingRef = React.useRef(false);
  if (showDemoSelector && !demoMode && !demoActivatingRef.current) {
    return <DemoSelector onSelect={(id) => {
      if (demoActivatingRef.current) return;
      demoActivatingRef.current = true;
      activateDemo(id);
      setShowDemoSelector(false);
    }} />;
  }`;

const NEW = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => {
      setShowDemoSelector(false);
      setTimeout(() => activateDemo(id), 0);
    }} />;
  }`;

if (main.includes(OLD)) {
  main = main.replace(OLD, NEW);
  console.log('✅ 1/1 DemoSelector: setShowDemoSelector(false) first, activateDemo in next tick');
} else {
  console.log('❌ Old anchor not found, trying alternate...');
  // Maybe the ref patch didn't apply - try the original
  const ALT = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => { activateDemo(id); setShowDemoSelector(false); }} />;
  }`;
  if (main.includes(ALT)) {
    main = main.replace(ALT, NEW);
    console.log('✅ 1/1 (alternate) Fixed DemoSelector callback');
  } else {
    console.log('❌ Neither anchor found');
    // Show what exists
    const idx = main.indexOf('showDemoSelector');
    if (idx > -1) console.log('Context:', main.substring(idx, idx + 200));
  }
}

fs.writeFileSync('src/main.jsx', main);

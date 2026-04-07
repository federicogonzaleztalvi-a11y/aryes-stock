const fs = require('fs');
let main = fs.readFileSync('src/main.jsx', 'utf8');

// Remove setTimeout — call activateDemo directly but ensure showDemoSelector 
// is false in the same render by checking demoMode in the condition
const OLD = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => {
      setShowDemoSelector(false);
      setTimeout(() => activateDemo(id), 0);
    }} />;
  }`;

const NEW = `  if (showDemoSelector && !demoMode) {
    return <DemoSelector onSelect={(id) => {
      activateDemo(id);
      setShowDemoSelector(false);
    }} />;
  }`;

if (main.includes(OLD)) {
  main = main.replace(OLD, NEW);
  fs.writeFileSync('src/main.jsx', main);
  console.log('✅ Removed setTimeout — direct activateDemo call');
} else {
  console.log('❌ not found');
}

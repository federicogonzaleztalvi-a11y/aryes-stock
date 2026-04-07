const fs = require('fs');

// The problem: demoState in useDemo.js is a useMemo that creates a new object
// But useMemo deps include demoData which is set by activateDemo
// Each time AppProvider re-renders, if demoState reference changes,
// the demo useEffect in AppContext runs again, causing setState, causing re-render
// 
// The REAL fix: the demo useEffect in AppContext depends on [isDemoMode, demoState]
// Since demoState is a new object each time (useMemo recalculates), this loops.
// Fix: only run the demo useEffect ONCE by tracking if we already loaded

let ctx = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const OLD = `  useEffect(() => {
    if (!isDemoMode || !demoState) return;
    try {`;

const NEW = `  const demoLoadedRef = React.useRef(false);
  useEffect(() => {
    if (!isDemoMode || !demoState) return;
    if (demoLoadedRef.current) return; // already loaded — prevent infinite loop
    demoLoadedRef.current = true;
    try {`;

if (ctx.includes(OLD)) {
  ctx = ctx.replace(OLD, NEW);
  fs.writeFileSync('src/context/AppContext.tsx', ctx);
  console.log('✅ Fixed infinite demo re-render loop with ref guard');
} else {
  console.log('❌ Anchor not found');
}

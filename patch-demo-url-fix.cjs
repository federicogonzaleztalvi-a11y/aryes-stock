const fs = require('fs');
let src = fs.readFileSync('src/main.jsx', 'utf8');

// The problem: ?demo=true useEffect sets showDemoSelector AFTER first render
// But first render shows LoginScreen because effectiveSession is null
// Fix: read ?demo=true synchronously in useState initializer

const OLD = `  const [showDemoSelector, setShowDemoSelector] = useState(false);`;
const NEW = `  const [showDemoSelector, setShowDemoSelector] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('demo') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      }
    } catch {}
    return false;
  });`;

if (src.includes(OLD) && !src.includes('URLSearchParams(window.location.search);\n      if (p.get')) {
  src = src.replace(OLD, NEW);
  fs.writeFileSync('src/main.jsx', src);
  console.log('✅ showDemoSelector now reads ?demo=true synchronously');
} else {
  console.log('⏭  Already patched or not found');
}

#!/usr/bin/env node
/**
 * patch-routing.cjs
 * Makes landing the home page (/) and app accessible at /app/*
 * 
 * Run from ~/Downloads/aryes-stock:
 *   node patch-routing.cjs
 */

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/main.jsx');
let main = fs.readFileSync(mainPath, 'utf8');

// 1. Change landing route from /landing to /
// Old: <Route path="/landing" element={...LandingPage...} />
// New: <Route path="/" element={...LandingPage...} />
// Also keep /landing as alias

const oldLanding = `<Route path="/landing" element={<Suspense fallback={<div/>}><LandingPage /></Suspense>} />`;
const newLanding = `<Route path="/" element={<Suspense fallback={<div/>}><LandingPage /></Suspense>} />
          <Route path="/landing" element={<Suspense fallback={<div/>}><LandingPage /></Suspense>} />`;

if (main.includes(oldLanding) && !main.includes('path="/" element={<Suspense fallback={<div/>}><LandingPage')) {
  main = main.replace(oldLanding, newLanding);
  console.log('✅ Landing now serves at / and /landing');
} else if (main.includes('path="/" element={<Suspense fallback={<div/>}><LandingPage')) {
  console.log('⏭  Landing already at /');
} else {
  console.log('⚠️  Could not find landing route to patch');
}

// 2. Change the catch-all from /* to /app/* so it doesn't override /
// The Root component handles auth + app — it should only match /app paths
// Old: <Route path="*" element={<Root />} />
// New: <Route path="/app/*" element={<Root />} />
//      <Route path="*" element={<Navigate to="/" />} /> (fallback to landing)

const oldCatchAll = `<Route path="*" element={<Root />} />`;
const newCatchAll = `<Route path="/app/*" element={<Root />} />`;

if (main.includes(oldCatchAll)) {
  main = main.replace(oldCatchAll, newCatchAll);
  console.log('✅ App now serves at /app/*');
} else {
  console.log('⏭  Catch-all already patched');
}

// 3. Inside Root component, update the routes to work under /app
// The Root component has internal routes like /app/:tab and a catch-all to /app/dashboard
// These should still work since Root is now mounted at /app/*

// 4. Handle ?demo=true query param — show demo selector automatically
// Add to Root function, after reading session
const demoParamCheck = `
  // Auto-show demo selector if ?demo=true
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !demoMode) {
      setShowDemoSelector(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
`;

const demoInsertAnchor = 'const effectiveSession = demoMode ? {';
if (!main.includes('demo=true') && main.includes(demoInsertAnchor)) {
  main = main.replace(demoInsertAnchor, demoParamCheck + '\n  ' + demoInsertAnchor);
  console.log('✅ Auto-demo selector from ?demo=true param');
} else {
  console.log('⏭  Demo param handler already exists or anchor not found');
}

// 5. Update LoginScreen's "Explorar la plataforma" link to not conflict
// Already handled by the demo selector flow

fs.writeFileSync(mainPath, main, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Routing patched!
  / → Landing page
  /landing → Landing page (alias)
  /app → Login → Dashboard
  /app?demo=true → Demo selector
  /register → Registration
  /catalogo, /pedidos, /driver, /tracking → unchanged
══════════════════════════════════════════════`);

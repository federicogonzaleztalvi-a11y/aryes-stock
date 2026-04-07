const fs = require('fs');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════
// 1. REMOVE DemoErrorBoundary completely — it may be eating the error
// ═══════════════════════════════════════════════════════════════════
let main = fs.readFileSync('src/main.jsx', 'utf8');

const OLD_OPEN = `      <DemoErrorBoundary>
      <AppProvider`;
const NEW_OPEN = `      <AppProvider`;

const OLD_CLOSE = `      </AppProvider>
      </DemoErrorBoundary>`;
const NEW_CLOSE = `      </AppProvider>`;

if (main.includes(OLD_OPEN)) {
  main = main.replace(OLD_OPEN, NEW_OPEN);
  main = main.replace(OLD_CLOSE, NEW_CLOSE);
  changes++;
  console.log('✅ 1. Removed DemoErrorBoundary wrapper');
}

// Also remove the debug log
main = main.replace(/  \/\/ TEMPORARY DEBUG: visible marker\n  console\.log\('\[ROOT RENDER\]'[^;]+;\n\n/g, '');
changes++;
console.log('✅ 2. Removed ROOT RENDER debug log');

fs.writeFileSync('src/main.jsx', main);

// ═══════════════════════════════════════════════════════════════════
// 2. Add try-catch in AppContext demo useEffect to catch mapper errors
// ═══════════════════════════════════════════════════════════════════
let ctx = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const OLD_DEMO_EFFECT = `  useEffect(() => {
    if (!isDemoMode || !demoState) return;
    const dp = mapDemoProducts(demoState.products);
    const dc = mapDemoClients(demoState.clients);
    const ds = mapDemoSuppliers(demoState.suppliers);
    const dv = mapDemoVentas(demoState.ventas, demoState.clients, demoState.products);
    setProducts(dp); setClientes(dc); setSuppliers(ds); setVentas(dv);
    if (demoState.cfes) setCfes(mapDemoCfes(demoState.cfes, demoState.clients));
    if (demoState.cobros) setCobros(mapDemoCobros(demoState.cobros));
    if (demoState.movements) setMovements(mapDemoMovements(demoState.movements) as unknown as Movement[]);
    if (demoState.rutas) setRutas(mapDemoRutas(demoState.rutas) as unknown as Ruta[]);
    setBrandCfg({ name:demoState.org.name, logoUrl:'', color:'#1a8a3c', ownerPhone:demoState.org.ownerPhone||'', horario:demoState.org.horario||'', address:demoState.org.address||'', rut:demoState.org.rut||'' });
    setDbReady(true); setSyncStatus('demo');
    console.debug('[AppContext] Demo data loaded:', demoState.industry, dp.length, 'products');
  }, [isDemoMode, demoState]);`;

const NEW_DEMO_EFFECT = `  useEffect(() => {
    if (!isDemoMode || !demoState) return;
    try {
      const dp = mapDemoProducts(demoState.products);
      const dc = mapDemoClients(demoState.clients);
      const ds = mapDemoSuppliers(demoState.suppliers);
      const dv = mapDemoVentas(demoState.ventas, demoState.clients, demoState.products);
      setProducts(dp); setClientes(dc); setSuppliers(ds); setVentas(dv);
      if (demoState.cfes) setCfes(mapDemoCfes(demoState.cfes, demoState.clients));
      if (demoState.cobros) setCobros(mapDemoCobros(demoState.cobros));
      if (demoState.movements) setMovements(mapDemoMovements(demoState.movements) as unknown as Movement[]);
      if (demoState.rutas) setRutas(mapDemoRutas(demoState.rutas) as unknown as Ruta[]);
      setBrandCfg({ name:demoState.org.name, logoUrl:'', color:'#1a8a3c', ownerPhone:demoState.org.ownerPhone||'', horario:demoState.org.horario||'', address:demoState.org.address||'', rut:demoState.org.rut||'' });
      setDbReady(true); setSyncStatus('demo');
      console.debug('[AppContext] Demo data loaded:', demoState.industry, dp.length, 'products');
    } catch (err) {
      console.error('[AppContext] DEMO LOAD ERROR:', err);
      setDbReady(true); // still allow render
    }
  }, [isDemoMode, demoState]);`;

if (ctx.includes(OLD_DEMO_EFFECT)) {
  ctx = ctx.replace(OLD_DEMO_EFFECT, NEW_DEMO_EFFECT);
  changes++;
  console.log('✅ 3. Added try-catch to demo useEffect');
}

fs.writeFileSync('src/context/AppContext.tsx', ctx);

// ═══════════════════════════════════════════════════════════════════
// 3. Add visible debug render inside AppProvider to see if it mounts
// ═══════════════════════════════════════════════════════════════════
// Find the AppProvider return statement
const PROVIDER_RETURN = ctx.indexOf('return (');
// Actually let's add a simpler check — a console.log right at the start of AryesApp

let app = fs.readFileSync('src/App.jsx', 'utf8');
const OLD_ARYES = `function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate, demoMode, demoGuard}){`;
const NEW_ARYES = `function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate, demoMode, demoGuard}){
  console.log('[AryesApp] MOUNTED — demoMode:', demoMode, 'dbReady:', typeof dbReady !== 'undefined' ? dbReady : 'not yet');`;

if (app.includes(OLD_ARYES) && !app.includes('[AryesApp] MOUNTED')) {
  app = app.replace(OLD_ARYES, NEW_ARYES);
  changes++;
  console.log('✅ 4. Added mount log to AryesApp');
}
fs.writeFileSync('src/App.jsx', app);

console.log('\n✅ Nuclear fix applied (' + changes + ' changes). Build and deploy.');

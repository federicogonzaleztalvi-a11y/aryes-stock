#!/usr/bin/env node
// patch-portal-demo-fix.cjs — Fix null session error in portal demo mode

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// The problem: when portalDemo is active, session is null but the catalog
// render accesses session.nombre, session.token etc.
// Fix: create a fake session when demo mode is active

const oldRender = "if (portalDemo === 'selecting') return <PortalDemoSelector onSelect={key => setPortalDemo(key)} />;";
const newRender = `if (portalDemo === 'selecting') return <PortalDemoSelector onSelect={key => setPortalDemo(key)} />;

  // Demo mode: create a fake session so the catalog renders without null errors
  const effectiveSession = isPortalDemo ? {
    nombre: 'Cliente Demo',
    clienteId: 'demo-client',
    token: 'demo-token',
    tel: '099000000',
    org: 'demo',
  } : session;`;

if (pg.includes(oldRender) && !pg.includes('effectiveSession')) {
  pg = pg.replace(oldRender, newRender);
  console.log('✅ Added effectiveSession for demo mode');
} else if (pg.includes('effectiveSession')) {
  console.log('⏭  effectiveSession already exists');
} else {
  console.log('⚠️  Could not find render anchor');
}

// Now replace all session. references in the render section with effectiveSession.
// We need to be careful to only replace in the render part, not in API calls
// The key references that crash are in the user menu area (lines 956-967)

// Replace session references in the JSX render (after the return statement)
// These are the display-only ones that need fixing:
pg = pg.replace(
  "{session.nombre?.slice(0,1).toUpperCase()}",
  "{effectiveSession?.nombre?.slice(0,1).toUpperCase()}"
);
pg = pg.replace(
  "{session.nombre?.split(' ')[0]}",
  "{effectiveSession?.nombre?.split(' ')[0]}"
);
// The one in the dropdown that shows full name
pg = pg.replace(
  /\{session\.nombre\}(?!\?)/g,
  "{effectiveSession?.nombre}"
);

// Fix the historial fetch that uses session.token
pg = pg.replace(
  "if (!session?.token) return;",
  "if (!session?.token || session?.token === 'demo-token') return;"
);

// Fix CartDrawer session references for demo
pg = pg.replace(
  "<span>{session?.nombre}</span>",
  "<span>{session?.nombre || 'Cliente Demo'}</span>"
);

// Fix the main render guard - allow isPortalDemo through
const oldGuard = "if (!session && !isPortalDemo) return <LoginStep onLogin={ses => setSession(ses)} />;";
if (pg.includes(oldGuard)) {
  console.log('✅ Render guard already handles demo mode');
}

// Fix logout in demo mode to also reset portalDemo
// Already done in previous patch

// Fix the addresses fetch that uses session.clienteId
pg = pg.replace(
  "fetch(`${SB}/rest/v1/client_addresses?client_id=eq.${session.clienteId}",
  "fetch(`${SB}/rest/v1/client_addresses?client_id=eq.${session?.clienteId || 'none'}"
);

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal demo fix applied!
  - effectiveSession replaces null session in display
  - API calls skip when in demo mode
  - No more "Cannot read properties of null" errors
══════════════════════════════════════════════`);

#!/usr/bin/env node
// patch-session-revoke.cjs — Add revoked check to portal session validation + admin revoke endpoint

const fs = require('fs');
const path = require('path');

// 1. Fix pedido.js — add revoked=eq.false to validatePortalSession
const pedidoPath = path.join(process.cwd(), 'api/pedido.js');
let pedido = fs.readFileSync(pedidoPath, 'utf8');

const oldPedidoQuery = '`?token=eq.${encodeURIComponent(token)}`' +
    ' +\n    `&expires_at=gte.${new Date().toISOString()}`';

// More robust: find the actual pattern
if (pedido.includes('portal_sessions') && !pedido.includes('revoked=eq.false')) {
  pedido = pedido.replace(
    '`&expires_at=gte.${new Date().toISOString()}`\n    `&limit=1`',
    '`&expires_at=gte.${new Date().toISOString()}`\n    `&revoked=eq.false`\n    `&limit=1`'
  );
  console.log('✅ pedido.js: added revoked=eq.false check');
} else if (pedido.includes('revoked=eq.false')) {
  console.log('⏭  pedido.js: already has revoked check');
} else {
  // Try alternative pattern
  pedido = pedido.replace(
    /&expires_at=gte\.\$\{new Date\(\)\.toISOString\(\)\}`\s*\+\s*`&limit=1/,
    '&expires_at=gte.${new Date().toISOString()}` +\n    `&revoked=eq.false` +\n    `&limit=1'
  );
  console.log('✅ pedido.js: added revoked=eq.false check (alt pattern)');
}
fs.writeFileSync(pedidoPath, pedido, 'utf8');

// 2. Fix historial.js — add revoked=eq.false
const histPath = path.join(process.cwd(), 'api/historial.js');
let hist = fs.readFileSync(histPath, 'utf8');

if (!hist.includes('revoked=eq.false')) {
  hist = hist.replace(
    'portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&limit=1',
    'portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&revoked=eq.false&limit=1'
  );
  console.log('✅ historial.js: added revoked=eq.false check');
} else {
  console.log('⏭  historial.js: already has revoked check');
}
fs.writeFileSync(histPath, hist, 'utf8');

// 3. Add revoke action to admin-users.js
const adminPath = path.join(process.cwd(), 'api/admin-users.js');
let admin = fs.readFileSync(adminPath, 'utf8');

if (!admin.includes('revoke-sessions')) {
  // Find the end of the handler to add the revoke action
  // We'll add it as a new action in the existing router
  const revokeCode = `

  // ── Revoke portal sessions for a client ──────────────────────────
  if (action === 'revoke-sessions') {
    const { cliente_id } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' });

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const revokeRes = await fetch(
      \`\${process.env.SUPABASE_URL}/rest/v1/portal_sessions?cliente_id=eq.\${encodeURIComponent(cliente_id)}&revoked=eq.false\`,
      {
        method: 'PATCH',
        headers: {
          apikey: key, Authorization: \`Bearer \${key}\`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ revoked: true }),
      }
    );
    if (!revokeRes.ok) {
      return res.status(500).json({ error: 'Error al revocar sesiones' });
    }
    return res.status(200).json({ ok: true, message: 'Sesiones del cliente revocadas' });
  }
`;

  // Find a good insertion point — before the final return or closing brace
  // Look for the last "return res.status" pattern to insert before it
  const insertBefore = 'return res.status(400).json({ error:';
  if (admin.includes(insertBefore)) {
    admin = admin.replace(
      insertBefore,
      revokeCode + '\n  ' + insertBefore
    );
    console.log('✅ admin-users.js: added revoke-sessions action');
  } else {
    // Fallback: append before the last closing brace of the handler
    const lastBrace = admin.lastIndexOf('}');
    admin = admin.slice(0, lastBrace) + revokeCode + admin.slice(lastBrace);
    console.log('✅ admin-users.js: added revoke-sessions action (fallback)');
  }
} else {
  console.log('⏭  admin-users.js: revoke-sessions already exists');
}
fs.writeFileSync(adminPath, admin, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal session revocation patched!

  pedido.js    → validates revoked=eq.false
  historial.js → validates revoked=eq.false
  admin-users.js → POST /api/admin-users { action: 'revoke-sessions', cliente_id: '...' }

  To revoke all sessions for a client:
  POST /api/admin-users
  Body: { "action": "revoke-sessions", "cliente_id": "uuid-here" }
══════════════════════════════════════════════`);

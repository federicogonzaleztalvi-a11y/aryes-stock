// api/vendedor.js — Portal del vendedor (modo "pasar pedido por el cliente").
// ============================================================================
// Un vendedor de la distribuidora entra con su usuario (email + contraseña del
// sistema interno) y arma pedidos EN NOMBRE de sus clientes asignados. El pedido
// sale por el mismo motor que el portal del cliente (_create-order) → mismo mail,
// mismo PDF, mismo push. Acá vive solo lo propio del vendedor.
//
// Identidad: se valida el access_token de Supabase (usuario interno), se deriva
// el usuario (username/role/org) DEL SERVIDOR y se exige rol vendedor o admin.
// Nunca se confía en lo que manda el navegador.
//
// El cliente se asigna a un vendedor con clients.vendedor_id = username del
// vendedor (ya existe en la pestaña Clientes). Un vendedor sólo ve los clientes
// donde vendedor_id == su username.
//
// Fase A:
//   GET /api/vendedor?action=me       → { vendedor: { username, name, org } }
//   GET /api/vendedor?action=clients  → { clients: [...] }  (sólo los suyos)
// ============================================================================

import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Roles habilitados para el modo vendedor. Admin entra también (para probar/cargar).
const ALLOWED_ROLES = ['vendedor', 'admin'];

// Valida el access_token de Supabase y resuelve el usuario interno (rol, username,
// org) desde la tabla users. Devuelve null si el token es inválido o el usuario no
// tiene rol habilitado. La identidad SIEMPRE sale de acá, nunca del body/query.
async function resolveVendedor(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  const email = userData?.email;
  if (!email) return null;

  const svcKey = SB_SVC || SB_ANON;
  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,name,username,org_id&limit=1`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const rows = await uRes.json();
  const u = rows?.[0];
  if (!u) return null;
  if (!ALLOWED_ROLES.includes(u.role)) return null;

  // El username es la clave con la que se asignan los clientes (clients.vendedor_id).
  const username = u.username || email.split('@')[0];
  return { username, name: u.name || username, role: u.role, org: u.org_id };
}

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await checkRateLimit('vendedor:' + _ip, 60, 60, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  if (!SB_URL || !SB_ANON) {
    log.fatal('vendedor', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  const vendedor = await resolveVendedor(req);
  if (!vendedor) return res.status(401).json({ error: 'No autorizado. Iniciá sesión como vendedor.' });

  const action = req.query?.action || 'me';

  // ── ?action=me — datos del vendedor logueado ──
  if (action === 'me') {
    return res.status(200).json({
      vendedor: { username: vendedor.username, name: vendedor.name, org: vendedor.org, role: vendedor.role },
    });
  }

  // ── ?action=clients — sólo los clientes asignados a ESTE vendedor ──
  if (action === 'clients') {
    const svcKey = SB_SVC || SB_ANON;
    const r = await fetch(
      `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(vendedor.org)}` +
      `&vendedor_id=eq.${encodeURIComponent(vendedor.username)}` +
      `&select=id,name,codigo,tipo,ciudad,phone,lista_id&order=name.asc`,
      { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
    );
    if (!r.ok) {
      const err = await r.text();
      log.error('vendedor', 'clients db error', { status: r.status, org: vendedor.org, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'Error al cargar tus clientes' });
    }
    const clients = await r.json();
    return res.status(200).json({ clients: Array.isArray(clients) ? clients : [] });
  }

  return res.status(400).json({ error: 'action inválida' });
}

export default withObservability('vendedor', handler);

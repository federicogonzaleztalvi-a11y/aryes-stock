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

// TTL de la sesión de portal que el vendedor "abre" en nombre del cliente.
// Corta (8h = una jornada) porque es una sesión operativa del vendedor, no del
// cliente final (cuyo OTP dura 90 días).
const OPEN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

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
  return { username, name: u.name || username, role: u.role, org: u.org_id, email };
}

// Claves candidatas con las que un cliente pudo haber quedado asignado a ESTE
// vendedor. Hoy el alta guarda el username, pero usuarios legacy (sin username)
// quedaron asignados por NOMBRE o por la parte local del email. Aceptamos las
// tres para que el vendedor vea sus clientes sin importar con cuál se guardó —
// todas identifican a la misma persona y la query igual filtra por org_id.
function vendedorKeys(vendedor) {
  const keys = new Set();
  if (vendedor.username) keys.add(vendedor.username);
  if (vendedor.name) keys.add(vendedor.name);
  if (vendedor.email) keys.add(vendedor.email.split('@')[0]);
  return [...keys].filter(Boolean);
}

// Arma un filtro PostgREST `in.(...)` con cada valor entre comillas dobles
// (los nombres tienen espacios). Devuelve el lado derecho del `=`, sin encodear.
function vendedorIdFilter(vendedor) {
  const list = vendedorKeys(vendedor).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  return 'in.(' + list + ')';
}

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await checkRateLimit('vendedor:' + _ip, 60, 60, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  if (!SB_URL || !SB_ANON) {
    log.fatal('vendedor', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  const vendedor = await resolveVendedor(req);
  if (!vendedor) return res.status(401).json({ error: 'No autorizado. Iniciá sesión como vendedor.' });

  const svcKey = SB_SVC || SB_ANON;
  const action = req.query?.action || 'me';

  // ── POST ?action=open — abrir el portal EN NOMBRE de un cliente del vendedor ──
  // Mintamos una sesión real de portal (portal_sessions) para ese cliente, igual
  // que la que sale del OTP, pero verificando en el servidor que el cliente sea
  // de ESTE vendedor (vendedor_id == username) y de su org. Con esa sesión el
  // front reusa el portal del cliente tal cual (catálogo con su lista, carrito,
  // pedido por el mismo motor) → mismo mail/PDF/push a la distribuidora.
  if (action === 'open') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const clienteId = req.body?.clienteId;
    if (!clienteId) return res.status(400).json({ error: 'clienteId requerido' });

    // SECURITY: el cliente debe pertenecer a este vendedor y a su org. Nunca se
    // confía en el navegador: se valida acá contra la DB.
    const cRes = await fetch(
      `${SB_URL}/rest/v1/clients?id=eq.${encodeURIComponent(clienteId)}` +
      `&org_id=eq.${encodeURIComponent(vendedor.org)}` +
      `&vendedor_id=${encodeURIComponent(vendedorIdFilter(vendedor))}` +
      `&select=id,name,lista_id,phone&limit=1`,
      { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
    );
    if (!cRes.ok) {
      const err = await cRes.text();
      log.error('vendedor', 'open client lookup error', { status: cRes.status, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'No se pudo abrir el cliente' });
    }
    const cRows = await cRes.json();
    const cli = cRows?.[0];
    if (!cli) return res.status(403).json({ error: 'Ese cliente no está asignado a vos.' });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OPEN_SESSION_TTL_MS).toISOString();
    const tel = (cli.phone || '').replace(/\D/g, '') || 'vendedor';
    const sRes = await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
      method: 'POST',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ token, cliente_id: cli.id, tel, org_id: vendedor.org, expires_at: expiresAt }),
    });
    if (!sRes.ok) {
      const err = await sRes.text();
      log.error('vendedor', 'open session insert error', { status: sRes.status, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'No se pudo abrir el cliente' });
    }
    log.info('vendedor', 'portal abierto por vendedor', { vendedor: vendedor.username, cliente: cli.id, org: vendedor.org });
    return res.status(200).json({
      session: {
        token, expiresAt,
        clienteId: cli.id,
        nombre: cli.name,
        listaId: cli.lista_id || null,
        tel,
        org: vendedor.org,
      },
    });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── ?action=me — datos del vendedor logueado ──
  if (action === 'me') {
    return res.status(200).json({
      vendedor: { username: vendedor.username, name: vendedor.name, org: vendedor.org, role: vendedor.role },
    });
  }

  // ── ?action=clients — sólo los clientes asignados a ESTE vendedor ──
  if (action === 'clients') {
    const r = await fetch(
      `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(vendedor.org)}` +
      `&vendedor_id=${encodeURIComponent(vendedorIdFilter(vendedor))}` +
      `&select=id,name,codigo,ciudad,phone,lista_id&order=name.asc`,
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

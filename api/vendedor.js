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
  if (vendedor.email) { keys.add(vendedor.email); keys.add(vendedor.email.split('@')[0]); }
  return [...keys].filter(Boolean);
}

// Arma un filtro PostgREST `in.(...)` con cada valor entre comillas dobles
// (los nombres tienen espacios). Devuelve el lado derecho del `=`, sin encodear.
function vendedorIdFilter(vendedor) {
  const list = vendedorKeys(vendedor).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  return 'in.(' + list + ')';
}

// Trae los clientes asignados a ESTE vendedor (id + datos útiles para el feed y el
// detalle: teléfono para WhatsApp, dirección y horario de entrega). Es la misma
// fuente de verdad que action=clients, reusada por action=pedidos y action=estado
// para no confiar nunca en lo que mande el navegador. Devuelve null si falla.
async function fetchVendedorClients(vendedor, svcKey) {
  const r = await fetch(
    `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(vendedor.org)}` +
    `&vendedor_id=${encodeURIComponent(vendedorIdFilter(vendedor))}` +
    `&select=id,name,phone,address,ciudad,horario_desde,horario_hasta&limit=2000`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
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
      // via_vendedor: marca que este pedido lo va a cargar el vendedor EN NOMBRE
      // del cliente → el motor NO le manda push al vendedor por su propio pedido
      // (sólo le avisa cuando el cliente pide SOLO, desde su sesión de OTP).
      body: JSON.stringify({ token, cliente_id: cli.id, tel, org_id: vendedor.org, expires_at: expiresAt, via_vendedor: true, vendedor_nombre: vendedor.name || vendedor.username }),
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

  // ── POST ?action=create-client — el vendedor da de alta un cliente nuevo ──
  // Igual que el alta del admin, pero acotado: org_id e identidad salen DEL
  // SERVIDOR. El cliente queda auto-asignado a ESTE vendedor (vendedor_id = su
  // email) → aparece de una en su lista (action=clients) sin pasar por el admin.
  // El teléfono es clave: es con lo que el cliente entra al portal por OTP.
  if (action === 'create-client') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (nombre.length > 200) return res.status(400).json({ error: 'Nombre demasiado largo (máx 200).' });
    const email = String(b.email || '').trim();
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido.' });
    const phone = String(b.telefono || '').trim().slice(0, 30);

    const row = {
      id:          crypto.randomUUID(),
      name:        nombre,
      type:        String(b.tipo || 'Otro').slice(0, 40),
      phone,
      email,
      contact:     String(b.contacto || '').slice(0, 120),
      contacto:    String(b.contacto || '').slice(0, 120),
      address:     String(b.direccion || '').slice(0, 200),
      ciudad:      String(b.ciudad || '').slice(0, 120),
      codigo:      String(b.codigo || '').slice(0, 60) || null,
      cond_pago:   'credito_30',
      org_id:      vendedor.org,          // ← del servidor, nunca del body
      vendedor_id: vendedor.email,        // ← auto-asignado a este vendedor
      created_at:  new Date().toISOString(),
    };

    const insRes = await fetch(`${SB_URL}/rest/v1/clients`, {
      method: 'POST',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!insRes.ok) {
      const err = await insRes.text();
      log.error('vendedor', 'create-client insert error', { status: insRes.status, org: vendedor.org, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'No se pudo guardar el cliente.' });
    }
    const created = (await insRes.json())?.[0] || row;
    log.info('vendedor', 'cliente creado por vendedor', { vendedor: vendedor.username, cliente: created.id, org: vendedor.org });
    return res.status(200).json({
      client: { id: created.id, name: created.name, codigo: created.codigo, ciudad: created.ciudad, phone: created.phone, lista_id: created.lista_id || null },
    });
  }

  // ── POST ?action=estado — el vendedor cambia el estado de un pedido suyo ──────
  // Hoy sólo habilitamos "entregada" (el vendedor que hace la entrega la marca
  // desde el cel). SECURITY: se valida que el pedido sea de un cliente de ESTE
  // vendedor y de su org antes de tocar nada. Se espeja a la venta (si existe)
  // para que el admin y el portal del cliente queden sincronizados.
  if (action === 'estado') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ESTADOS_PERMITIDOS = ['entregada'];
    const orderId = req.body?.orderId;
    const nuevo   = String(req.body?.estado || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    if (!ESTADOS_PERMITIDOS.includes(nuevo)) return res.status(400).json({ error: 'Estado no permitido' });

    const oRes = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(orderId)}` +
      `&org_id=eq.${encodeURIComponent(vendedor.org)}&select=id,cliente_id,venta_id&limit=1`,
      { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
    );
    if (!oRes.ok) {
      const err = await oRes.text();
      log.error('vendedor', 'estado order lookup error', { status: oRes.status, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'No se pudo actualizar el pedido' });
    }
    const order = (await oRes.json())?.[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const clients = await fetchVendedorClients(vendedor, svcKey);
    if (clients === null) return res.status(502).json({ error: 'No se pudo validar el pedido' });
    if (!clients.some(c => c.id === order.cliente_id))
      return res.status(403).json({ error: 'Ese pedido no es de un cliente tuyo.' });

    const pRes = await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (!pRes.ok) {
      const err = await pRes.text();
      log.error('vendedor', 'estado patch error', { status: pRes.status, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'No se pudo actualizar el pedido' });
    }

    // Espejar a la venta (si el pedido ya fue importado) → admin y portal en sync.
    if (order.venta_id) {
      fetch(`${SB_URL}/rest/v1/ventas?id=eq.${encodeURIComponent(order.venta_id)}`, {
        method: 'PATCH',
        headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: nuevo }),
      }).catch(() => {});
    }

    log.info('vendedor', 'estado cambiado por vendedor', { vendedor: vendedor.username, order: orderId, estado: nuevo });
    return res.status(200).json({ ok: true, estado: nuevo });
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

  // ── ?action=pedidos — los pedidos de los clientes de ESTE vendedor ───────────
  // Feed de lectura para el portal mobile: trae los pedidos (b2b_orders) de todos
  // sus clientes asignados, con el teléfono y los datos de entrega del cliente
  // adjuntos (para WhatsApp y el detalle). Sin costo ni margen: el item sólo lleva
  // el precio de venta. Mismo filtro de seguridad que el resto (org + sus clientes).
  if (action === 'pedidos') {
    const clients = await fetchVendedorClients(vendedor, svcKey);
    if (clients === null) {
      log.error('vendedor', 'pedidos clients db error', { org: vendedor.org });
      return res.status(502).json({ error: 'Error al cargar tus pedidos' });
    }
    if (!clients.length) return res.status(200).json({ pedidos: [] });

    const byId = new Map(clients.map(c => [c.id, c]));
    const inList = 'in.(' + clients.map(c => c.id).join(',') + ')';
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?org_id=eq.${encodeURIComponent(vendedor.org)}` +
      `&cliente_id=${encodeURIComponent(inList)}&order=creado_en.desc&limit=100`,
      { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
    );
    if (!r.ok) {
      const err = await r.text();
      log.error('vendedor', 'pedidos db error', { status: r.status, org: vendedor.org, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'Error al cargar tus pedidos' });
    }
    const orders = await r.json();
    const pedidos = (Array.isArray(orders) ? orders : []).map(o => {
      const c = byId.get(o.cliente_id) || {};
      return {
        id:            o.id,
        clienteId:     o.cliente_id,
        clienteNombre: o.cliente_nombre || c.name || 'Cliente',
        total:         Number(o.total || 0),
        estado:        o.estado || 'pendiente',
        creadoEn:      o.creado_en,
        items:         Array.isArray(o.items) ? o.items : [],
        notas:         o.notas || '',
        tel:           c.phone || '',
        direccion:     c.address || '',
        ciudad:        c.ciudad || '',
        horarioDesde:  c.horario_desde || '',
        horarioHasta:  c.horario_hasta || '',
      };
    });
    return res.status(200).json({ pedidos });
  }

  // ── ?action=porvisitar — clientes del vendedor que hace rato no le compran ────
  // "Vendedor digital": juntamos el último pedido de cada cliente asignado y
  // devolvemos los que no piden hace >= UMBRAL días (o nunca pidieron), ordenados
  // del más atrasado al menos. El vendedor los ve al abrir la app → sabe a quién
  // visitar. Read-only, sin tocar nada compartido.
  if (action === 'porvisitar') {
    const UMBRAL_DIAS = 21;
    const clients = await fetchVendedorClients(vendedor, svcKey);
    if (clients === null) {
      log.error('vendedor', 'porvisitar clients db error', { org: vendedor.org });
      return res.status(502).json({ error: 'Error al cargar tu cartera' });
    }
    if (!clients.length) return res.status(200).json({ clientes: [], umbralDias: UMBRAL_DIAS });

    const inList = 'in.(' + clients.map(c => c.id).join(',') + ')';
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?org_id=eq.${encodeURIComponent(vendedor.org)}` +
      `&cliente_id=${encodeURIComponent(inList)}&select=cliente_id,creado_en&order=creado_en.desc&limit=2000`,
      { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
    );
    const orders = r.ok ? await r.json() : [];
    const ultimo = new Map();
    for (const o of (Array.isArray(orders) ? orders : [])) {
      if (!ultimo.has(o.cliente_id)) ultimo.set(o.cliente_id, o.creado_en); // desc → el primero es el más reciente
    }

    const now = Date.now();
    const lista = clients.map(c => {
      const ult = ultimo.get(c.id) || null;
      const dias = ult ? Math.floor((now - new Date(ult).getTime()) / 86400000) : null;
      return { id: c.id, nombre: c.name, tel: c.phone || '', ciudad: c.ciudad || '', ultimoPedido: ult, dias };
    })
      .filter(c => c.dias === null || c.dias >= UMBRAL_DIAS)
      .sort((a, b) => {
        if (a.dias === null) return 1;   // "nunca pidió" al final
        if (b.dias === null) return -1;
        return b.dias - a.dias;          // más atrasado primero
      });

    return res.status(200).json({ clientes: lista, umbralDias: UMBRAL_DIAS });
  }

  return res.status(400).json({ error: 'action inválida' });
}

export default withObservability('vendedor', handler);

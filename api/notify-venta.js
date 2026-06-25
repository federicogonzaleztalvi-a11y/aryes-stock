// api/notify-venta.js — Dispara el mail de "nuevo pedido" (con la orden en PDF)
// cuando se crea una venta desde la pestaña Ventas del admin.
//
// El portal B2B ya lo hace dentro de createB2BOrder → sendOrderEmail. La pestaña
// Ventas escribe la venta vía RPC create_venta (sin pasar por ese flujo), así que
// este endpoint reusa sendOrderEmail para que el mail salga idéntico (mismo
// template + mismo PDF). Destino: casilla configurada de la org, o el override
// que el admin escriba en el formulario.
//
// SECURITY: el org se deriva de la sesión admin verificada (JWT), NUNCA del body,
// para evitar que un admin de una org dispare mails en nombre de otra.

import { setCorsHeaders } from './_cors.js';
import { sendOrderEmail } from './_create-order.js';
import { checkRateLimit } from './_rate-limit.js';

const SB_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Roles internos habilitados a disparar el mail de la venta. Cualquier usuario que
// pueda cargar una venta (no solo el admin) debe poder mandar su mail. Antes esto
// exigía 'admin' → con un vendedor/operador el mail NO salía y el destino por
// defecto no figuraba (GET también daba 401). El org SIEMPRE sale del token, así
// que ampliar los roles no abre cross-tenant.
const ALLOWED_ROLES = ['admin', 'vendedor', 'operador', 'contador'];

// Verifica que el caller sea un usuario interno habilitado — valida la firma del
// JWT vía Supabase Auth (no decodificación insegura) y confirma el rol en la DB.
// Devuelve { email, orgId, role } o null. Mismo patrón que api/admin-users.js.
async function verifyUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!SERVICE_KEY) return null;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  if (!userData?.id || !userData?.email) return null;

  const roleRes = await fetch(`${SB_URL}/rest/v1/rpc/get_user_role_by_email`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ user_email: userData.email }),
  });
  const role = roleRes.ok ? await roleRes.json() : null;
  if (!ALLOWED_ROLES.includes(role)) return null;

  let orgId = userData.user_metadata?.org_id || null;
  if (!orgId) {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(userData.email)}&select=org_id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
    );
    if (orgRes.ok) orgId = (await orgRes.json())?.[0]?.org_id || null;
  }
  return { email: userData.email, orgId: orgId || 'aryes', role };
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyUser(req.headers['authorization'] || req.headers['Authorization']);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });

  // GET → devuelve la casilla por defecto de la org (para mostrarla en el form
  // Ventas y evitar que el admin no sepa a dónde va el mail si deja el campo vacío).
  if (req.method === 'GET') {
    try {
      const orgRes = await fetch(
        `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(admin.orgId)}&select=order_notify_email&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
      );
      const rows = orgRes.ok ? await orgRes.json() : [];
      return res.status(200).json({ defaultEmail: rows?.[0]?.order_notify_email || null });
    } catch {
      return res.status(200).json({ defaultEmail: null });
    }
  }

  // Rate limit por admin — el mail no es crítico, no failClosed.
  if (!(await checkRateLimit('notify-venta:' + admin.email, 60, 30))) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });
  }

  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: 'Sin items' });

  try {
    const result = await sendOrderEmail({
      org: admin.orgId,                       // ← derivado de la sesión, no del body
      clienteId: b.clienteId || '',
      clienteNombre: b.clienteNombre || 'Cliente',
      items,
      total: Number(b.total) || 0,
      notas: b.notas || '',
      orderId: b.orderId || ('V-' + Date.now()),
      toOverride: b.toEmail || '',
    });
    return res.status(200).json(result || { ok: false, reason: 'unknown' });
  } catch (e) {
    console.error('[notify-venta] error:', e.message);
    return res.status(500).json({ ok: false, error: 'Error al enviar el mail' });
  }
}

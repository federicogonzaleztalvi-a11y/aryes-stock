// api/perfil.js — datos de facturación/entrega que el CLIENTE completa en su
// propio checkout (self-service). Scopeado SIEMPRE por la sesión de portal: sólo
// lee/escribe la fila del cliente de ESA sesión (cliente_id + org_id del token,
// nunca del body) → sin IDOR / cross-tenant.
//
// NUNCA toca cond_pago, límite de crédito, lista ni vendedor: esos los define el
// distribuidor (Eric), no el cliente. Sólo la whitelist CAMPOS.
//
//   GET  /api/perfil           → { perfil: { ...campos actuales } }
//   POST /api/perfil  { campo } → guarda sólo los campos de la whitelist

import { getBearerToken, validatePortalSession } from './_session.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// Campos que el cliente PUEDE ver/editar de su propia ficha. Todo lo demás queda
// fuera (cond_pago, limite_credito, lista_id, vendedor_id, org_id, activo, …).
const CAMPOS = [
  'razon_social', 'rut', 'email_facturacion', 'direccion_fiscal',
  'address', 'ciudad', 'zona_entrega', 'dias_recepcion',
  'horario_desde', 'horario_hasta', 'notas_entrega',
  'contacto', 'celular', 'telefono_cobranza', 'email_cobranza',
];

function clean(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = SB_SVC || SB_ANON;
  if (!SB_URL || !key) return res.status(500).json({ error: 'Server misconfigured' });

  const session = await validatePortalSession(getBearerToken(req));
  if (!session || !session.cliente_id) return res.status(401).json({ error: 'Sesión inválida' });

  const cid = encodeURIComponent(session.cliente_id);
  const org = encodeURIComponent(session.org_id);
  const H   = { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' };

  // ── GET: datos actuales (para prefilear el checkout) ───────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${cid}&org_id=eq.${org}&select=${CAMPOS.join(',')}&limit=1`,
        { headers: H }
      );
      const rows = r.ok ? await r.json() : [];
      return res.status(200).json({ perfil: rows?.[0] || {} });
    } catch { return res.status(502).json({ error: 'Database error' }); }
  }

  // ── POST: guardar sólo los campos de la whitelist ──────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const patch = {};
    for (const k of CAMPOS) {
      if (k in body) patch[k] = clean(body[k], k === 'notas_entrega' ? 500 : 300);
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada para guardar' });
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${cid}&org_id=eq.${org}`,
        { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(patch) }
      );
      if (!r.ok) return res.status(502).json({ error: 'No se pudieron guardar los datos' });
      return res.status(200).json({ ok: true });
    } catch { return res.status(502).json({ error: 'Database error' }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

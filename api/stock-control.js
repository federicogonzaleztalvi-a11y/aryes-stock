// api/stock-control.js — Toggle self-service "¿Esta distribuidora controla inventario?"
// ----------------------------------------------------------------------------
// Cada distribuidor decide, desde Configuración, si Pazque controla su stock o no.
// Lo guarda en organizations.no_controla_stock (BOOLEAN). El trigger
// trg_default_stock_sin_control (supabase-no-controla-stock.sql) usa ese flag para,
// cuando la org NO controla inventario, autocompletar stock=99999 en productos que
// entren en 0/null → así nunca se bloquea un pedido por stock mal cargado.
//
// Este endpoint, además de prender/apagar el flag, hace el BACKFILL de los productos
// existentes para que el cambio sea inmediato y turnkey (cero SQL del lado de Federico):
//   • Apagar control (no controla):  productos en 0/null  → 99999  (no bloquean)
//   • Prender control (sí controla): productos en 99999   → 0      (para cargar reales)
//
// Multi-tenant: TODO scoped por org del admin. Genérico, nada hardcodeado.
//
// GET  ?action=status              → { controla }
// POST ?action=set  { controla }   → cambia el flag + backfill, devuelve { controla, ajustados }

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STOCK_ALTO = 99999;

function svcHeaders(extra = {}) {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json', ...extra };
}

// Valida el JWT del admin y resuelve { org }. Solo rol admin (configurar el control
// de stock es acción sensible). Mismo patrón que simpliroute.js / whatsapp-connect.js.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const k = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: k, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

async function getFlag(org) {
  const r = await fetch(
    `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=no_controla_stock&limit=1`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return null;
  return (await r.json())?.[0]?.no_controla_stock === true;
}

// Cuenta filas afectadas leyendo el header Content-Range (formato "*/N").
function parseCount(res) {
  const cr = res.headers.get('content-range') || '';
  const n = Number(cr.split('/').pop());
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });
  const org = admin.org;
  const action = req.query?.action || 'status';

  // ── GET status: ¿la org controla inventario? ──
  if (action === 'status' && req.method === 'GET') {
    const noControla = await getFlag(org);
    if (noControla === null) return res.status(500).json({ error: 'No se pudo leer la configuración' });
    return res.status(200).json({ controla: !noControla });
  }

  // ── POST set: cambia el flag + backfill de productos ──
  if (action === 'set' && req.method === 'POST') {
    const controla = req.body?.controla === true;
    const noControla = !controla;

    // 1) Guardar el flag.
    const upd = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
      method: 'PATCH',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ no_controla_stock: noControla }),
    });
    if (!upd.ok) return res.status(500).json({ error: 'No se pudo guardar el cambio' });

    // 2) Backfill de productos existentes para que el cambio sea inmediato.
    let ajustados = 0;
    try {
      let url, body;
      if (noControla) {
        // No controla: productos en 0/null → stock alto (no bloquean pedidos).
        url = `${SB_URL}/rest/v1/products?org_id=eq.${encodeURIComponent(org)}&or=(stock.is.null,stock.eq.0)`;
        body = { stock: STOCK_ALTO };
      } else {
        // Sí controla: limpiar el stock alto auto (99999) → 0 para cargar reales.
        url = `${SB_URL}/rest/v1/products?org_id=eq.${encodeURIComponent(org)}&stock=eq.${STOCK_ALTO}`;
        body = { stock: 0 };
      }
      const pr = await fetch(url, {
        method: 'PATCH',
        headers: svcHeaders({ Prefer: 'return=minimal,count=exact' }),
        body: JSON.stringify(body),
      });
      if (pr.ok) ajustados = parseCount(pr);
    } catch { /* el flag ya quedó guardado; el trigger cubre los nuevos */ }

    return res.status(200).json({ ok: true, controla, ajustados });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}

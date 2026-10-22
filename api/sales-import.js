// api/sales-import.js — Importador del informe "Movimiento de productos" (ERP).
// ----------------------------------------------------------------------------
// Alimenta la tabla sales_lines (capa de ventas) con el histórico que el
// distribuidor baja de su ERP (Mercado). El informe real tiene ~18.000 líneas y
// 2 años de historia, así que el parseo ocurre EN EL NAVEGADOR (SheetJS) y acá
// llegan las filas ya normalizadas, en tandas (chunks), para no pegarle al límite
// de body de Vercel.
//
// Identidad: se valida el access_token del admin y se deriva el org DEL SERVIDOR.
// Solo rol admin (importar datos de toda la cartera es acción sensible).
//
// Semántica de reemplazo por lote (import_batch):
//   - El cliente genera un batch_id (uuid) y manda todas las tandas con ese id.
//   - En la tanda final (commit:true) el server borra las filas canal='mercado'
//     de OTROS lotes → el informe nuevo reemplaza al viejo, sin dejar duplicados,
//     y sin ventana de "cartera vacía" si algo falla a mitad de camino.
//
// POST /api/sales-import  body: { batch_id, rows:[{fecha,rs,nombre,producto,familia,cantidad,importe,codigo}], commit? }

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ROWS_PER_CHUNK = 3000;   // defensivo: evita bodies gigantes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida el JWT del admin y resuelve { org } desde la tabla users. Solo admin.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  const email = userData?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

// Normaliza y valida UNA fila venida del cliente. Devuelve el objeto para insertar
// o null si la fila es basura (fecha o producto faltante). El cliente ya parseó
// números y fechas, pero validamos de nuevo (no confiamos en el cliente).
function normRow(r, org, batchId) {
  const fecha = String(r.fecha || '').slice(0, 10);          // 'YYYY-MM-DD'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const producto = String(r.producto || '').trim();
  const rs = String(r.rs || '').trim();
  if (!producto || !rs) return null;
  const cantidad = Number(r.cantidad);
  const importe  = Number(r.importe);
  return {
    org_id:       org,
    fecha,
    razon_social: rs,
    nombre:       String(r.nombre || '').trim(),
    producto,
    familia:      String(r.familia || '').trim(),
    cantidad:     Number.isFinite(cantidad) ? cantidad : 0,
    importe:      Number.isFinite(importe)  ? importe  : 0,
    codigo:       r.codigo != null && r.codigo !== '' ? String(r.codigo).trim() : null,
    canal:        'mercado',
    import_batch: batchId,
  };
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_SVC) return res.status(500).json({ error: 'Server misconfigured' });

  const auth = await resolveAdmin(req);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  const { org } = auth;

  const body = typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  })();

  const batchId = String(body.batch_id || '');
  if (!UUID_RE.test(batchId)) return res.status(400).json({ error: 'batch_id inválido' });

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length > MAX_ROWS_PER_CHUNK) {
    return res.status(413).json({ error: `Máximo ${MAX_ROWS_PER_CHUNK} filas por tanda` });
  }

  const svcH = {
    apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC,
    'Content-Type': 'application/json', Prefer: 'return=minimal',
  };

  // Insertar la tanda (si trae filas).
  let inserted = 0;
  if (rows.length) {
    const clean = rows.map(r => normRow(r, org, batchId)).filter(Boolean);
    if (clean.length) {
      const r = await fetch(`${SB_URL}/rest/v1/sales_lines`, {
        method: 'POST', headers: svcH, body: JSON.stringify(clean),
      });
      if (!r.ok) {
        console.error('[sales-import] insert error:', await r.text());
        return res.status(502).json({ error: 'Error al guardar filas' });
      }
      inserted = clean.length;
    }
  }

  // Commit: el informe nuevo reemplaza al viejo. Borramos las filas de Mercado de
  // esta org que NO son de este lote (lotes anteriores). Los datos del portal
  // (canal='portal') nunca se tocan.
  let replaced = false;
  if (body.commit === true) {
    const del = await fetch(
      `${SB_URL}/rest/v1/sales_lines?org_id=eq.${encodeURIComponent(org)}` +
      `&canal=eq.mercado&import_batch=neq.${encodeURIComponent(batchId)}`,
      { method: 'DELETE', headers: svcH }
    );
    if (!del.ok) {
      console.error('[sales-import] cleanup error:', await del.text());
      // No es fatal: los datos nuevos ya están; solo quedaron viejos conviviendo.
    } else {
      replaced = true;
    }
  }

  return res.status(200).json({ ok: true, inserted, replaced });
}

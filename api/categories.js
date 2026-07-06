// Vercel Serverless — Admin de categorías (taxonomía)
// Todas las escrituras usan service_role (bypassea RLS), scopeadas al org del
// admin autenticado. Motivo: las policies RLS de `categories` bloquean el INSERT
// desde el cliente (org de sesión ≠ get_my_org_id()), así que crear/renombrar/
// borrar/reordenar fallaban en silencio. Acá lo resolvemos server-side.
//
// Todo opera POR NOMBRE (no por id): una categoría puede "existir" solo porque
// productos la usan, sin fila en `categories` todavía. Operar por nombre hace que
// crear/renombrar/borrar/reordenar anden igual, y materializa la fila si falta.
//
// El portal lee `categories` server-side (api/_catalog.js) para armar el árbol y
// su orden, por eso reordenar acá = reordenar en el portal del cliente.

import { setCorsHeaders } from './_cors.js';

const SB_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enc = encodeURIComponent;
const norm = (s) => String(s || '').trim();

const svcHeaders = (extra = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...extra,
});

async function rpc(fnName, params = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST', headers: svcHeaders(), body: JSON.stringify(params),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, data };
}

// Verifica firma del JWT + rol admin, y resuelve el org del admin (igual patrón
// que api/admin-users.js). Devuelve null si no es admin válido.
async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ') || !SERVICE_KEY) return null;
  const token = authHeader.slice(7);
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  if (!userData?.id || !userData?.email) return null;
  const { ok, data: role } = await rpc('get_user_role_by_email', { user_email: userData.email });
  if (!ok || role !== 'admin') return null;
  let orgId = userData.user_metadata?.org_id || userData.app_metadata?.org_id || null;
  if (!orgId) {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/users?email=eq.${enc(userData.email)}&select=org_id&limit=1`,
      { headers: svcHeaders() });
    if (orgRes.ok) { const rows = await orgRes.json(); orgId = rows?.[0]?.org_id || null; }
  }
  return orgId ? { email: userData.email, orgId } : null;
}

const sbGet = async (path) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svcHeaders() });
  return r.ok ? r.json() : [];
};
const sbInsert = async (table, row) => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST', headers: svcHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(row),
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => null);
  return Array.isArray(rows) ? rows[0] : rows;
};
const sbPatch = async (table, query, data) => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(data),
  });
  return r.ok;
};
const sbDelete = async (table, query) => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: svcHeaders() });
  return r.ok;
};

// Devuelve la fila madre por nombre (o null). No crea.
async function findMadre(org, nombre) {
  const rows = await sbGet(`categories?select=id,nombre,orden&org_id=eq.${enc(org)}&parent_id=is.null&nombre=ilike.${enc(nombre)}&limit=1`);
  return rows?.[0] || null;
}
// Asegura que exista la fila madre; la crea si falta. Devuelve su id.
async function ensureMadre(org, nombre) {
  const found = await findMadre(org, nombre);
  if (found) return found.id;
  const hermanos = await sbGet(`categories?select=id&org_id=eq.${enc(org)}&parent_id=is.null`);
  const row = await sbInsert('categories', { org_id: org, nombre, parent_id: null, orden: hermanos.length });
  return row?.id || null;
}
async function findSub(org, parentId, nombre) {
  const rows = await sbGet(`categories?select=id,nombre,orden&org_id=eq.${enc(org)}&parent_id=eq.${enc(parentId)}&nombre=ilike.${enc(nombre)}&limit=1`);
  return rows?.[0] || null;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SERVICE_KEY) { console.error('[categories] SERVICE_ROLE_KEY missing'); return res.status(500).json({ error: 'Server misconfiguration' }); }

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Forbidden: admin only' });
  const org = admin.orgId;
  const { action } = req.query;

  try {
    // ── LIST ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && (action === 'list' || !action)) {
      const rows = await sbGet(`categories?select=id,nombre,parent_id,orden&org_id=eq.${enc(org)}&order=orden.asc,nombre.asc`);
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    // ── CREATE (madre o subcategoría, por nombre) ───────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      const nombre = norm(req.body?.nombre);
      const parentNombre = norm(req.body?.parent_nombre);
      if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
      if (parentNombre) {
        const parentId = await ensureMadre(org, parentNombre);
        if (!parentId) return res.status(500).json({ error: 'No se pudo resolver la categoría madre' });
        if (await findSub(org, parentId, nombre)) return res.status(409).json({ error: 'Ya existe esa subcategoría' });
        const hermanos = await sbGet(`categories?select=id&org_id=eq.${enc(org)}&parent_id=eq.${enc(parentId)}`);
        const row = await sbInsert('categories', { org_id: org, nombre, parent_id: parentId, orden: hermanos.length });
        if (!row) return res.status(500).json({ error: 'No se pudo crear' });
        return res.status(201).json(row);
      }
      if (await findMadre(org, nombre)) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      const id = await ensureMadre(org, nombre);
      return id ? res.status(201).json({ id, nombre }) : res.status(500).json({ error: 'No se pudo crear' });
    }

    // ── RENAME (propaga a productos; materializa fila si falta) ─────────────────
    if (req.method === 'PATCH' && action === 'rename') {
      const esMadre = !!req.body?.es_madre;
      const actual = norm(req.body?.nombre_actual);
      const nuevo = norm(req.body?.nombre_nuevo);
      const parentNombre = norm(req.body?.parent_nombre);
      if (!actual || !nuevo) return res.status(400).json({ error: 'nombre_actual y nombre_nuevo requeridos' });
      if (esMadre) {
        if (actual.toLowerCase() !== nuevo.toLowerCase() && await findMadre(org, nuevo))
          return res.status(409).json({ error: 'Ya existe otra categoría con ese nombre' });
        const row = await findMadre(org, actual);
        if (row) await sbPatch('categories', `id=eq.${enc(row.id)}&org_id=eq.${enc(org)}`, { nombre: nuevo });
        await sbPatch('products', `category=eq.${enc(actual)}&org_id=eq.${enc(org)}`, { category: nuevo });
      } else {
        const parentId = parentNombre ? await ensureMadre(org, parentNombre) : null;
        if (parentId) {
          if (actual.toLowerCase() !== nuevo.toLowerCase() && await findSub(org, parentId, nuevo))
            return res.status(409).json({ error: 'Ya existe otra subcategoría con ese nombre' });
          const row = await findSub(org, parentId, actual);
          if (row) await sbPatch('categories', `id=eq.${enc(row.id)}&org_id=eq.${enc(org)}`, { nombre: nuevo });
        }
        await sbPatch('products', `subcategoria=eq.${enc(actual)}&org_id=eq.${enc(org)}`, { subcategoria: nuevo });
      }
      return res.status(200).json({ ok: true });
    }

    // ── DELETE (cascade subs; limpia productos) ─────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete') {
      const esMadre = !!req.body?.es_madre;
      const nombre = norm(req.body?.nombre);
      const parentNombre = norm(req.body?.parent_nombre);
      if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
      if (esMadre) {
        const row = await findMadre(org, nombre);
        if (row) {
          const subs = await sbGet(`categories?select=nombre&parent_id=eq.${enc(row.id)}&org_id=eq.${enc(org)}`);
          for (const s of subs || []) await sbPatch('products', `subcategoria=eq.${enc(s.nombre)}&org_id=eq.${enc(org)}`, { subcategoria: '' });
          await sbDelete('categories', `id=eq.${enc(row.id)}&org_id=eq.${enc(org)}`);
        }
        await sbPatch('products', `category=eq.${enc(nombre)}&org_id=eq.${enc(org)}`, { category: '' });
      } else {
        const parentId = parentNombre ? await findMadre(org, parentNombre) : null;
        if (parentId?.id) {
          const row = await findSub(org, parentId.id, nombre);
          if (row) await sbDelete('categories', `id=eq.${enc(row.id)}&org_id=eq.${enc(org)}`);
        }
        await sbPatch('products', `subcategoria=eq.${enc(nombre)}&org_id=eq.${enc(org)}`, { subcategoria: '' });
      }
      return res.status(200).json({ ok: true });
    }

    // ── REORDER (por nombre; materializa lo que falte) ──────────────────────────
    // Payload: { madres: [{ nombre, subs: [nombre, ...] }, ...] }
    // Idempotente: crea filas faltantes y fija `orden` según el índice. Así el
    // arrastre de categorías derivadas de productos (sin fila) también persiste.
    if (req.method === 'POST' && action === 'reorder') {
      const madres = Array.isArray(req.body?.madres) ? req.body.madres : null;
      if (!madres) return res.status(400).json({ error: 'madres requerido' });
      const existing = await sbGet(`categories?select=id,nombre,parent_id&org_id=eq.${enc(org)}`);
      const madreId = new Map();
      const subId = new Map();
      (existing || []).forEach((c) => {
        if (c.parent_id == null) madreId.set(c.nombre.toLowerCase(), c.id);
        else subId.set(`${c.parent_id}::${c.nombre.toLowerCase()}`, c.id);
      });
      for (let i = 0; i < madres.length; i++) {
        const nombre = norm(madres[i]?.nombre); if (!nombre) continue;
        let id = madreId.get(nombre.toLowerCase());
        if (!id) {
          const row = await sbInsert('categories', { org_id: org, nombre, parent_id: null, orden: i });
          if (row) { id = row.id; madreId.set(nombre.toLowerCase(), id); }
        } else {
          await sbPatch('categories', `id=eq.${enc(id)}&org_id=eq.${enc(org)}`, { orden: i });
        }
        if (!id) continue;
        const subs = Array.isArray(madres[i]?.subs) ? madres[i].subs : [];
        for (let j = 0; j < subs.length; j++) {
          const sn = norm(subs[j]); if (!sn) continue;
          const key = `${id}::${sn.toLowerCase()}`;
          let sid = subId.get(key);
          if (!sid) {
            const row = await sbInsert('categories', { org_id: org, nombre: sn, parent_id: id, orden: j });
            if (row) { sid = row.id; subId.set(key, sid); }
          } else {
            await sbPatch('categories', `id=eq.${enc(sid)}&org_id=eq.${enc(org)}`, { orden: j });
          }
        }
      }
      const rows = await sbGet(`categories?select=id,nombre,parent_id,orden&org_id=eq.${enc(org)}&order=orden.asc,nombre.asc`);
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    return res.status(400).json({ error: 'Acción no reconocida' });
  } catch (e) {
    console.error('[categories] action:', action, 'error:', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

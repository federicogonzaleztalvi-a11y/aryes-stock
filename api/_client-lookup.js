// api/_client-lookup.js — Buscar un cliente por teléfono dentro de un org,
// tolerante al formato del número guardado.
// ============================================================================
// El portal limpia lo que escribe el cliente a solo dígitos (telClean), pero
// clients.phone puede estar guardado "lindo" — ej. "+598 96 425 798". Un LIKE por
// dígitos contiguos (*96425798) NO matchea ese valor porque los espacios cortan
// la secuencia → el cliente quedaba como "Número no registrado".
//
// Estrategia:
//   1. Camino rápido: match exacto o LIKE por últimos 8 dígitos. Para números
//      guardados sin espacios pega acá sin traer toda la lista (barato).
//   2. Fallback tolerante: traer los clientes del org con teléfono y comparar por
//      dígitos normalizados en JS. Cubre cualquier formato (espacios/guiones/+).
//      Solo corre cuando el camino rápido falla (datos "feos"), no en el caso común.
//   3. Teléfonos adicionales (client_phones), match exacto y revalidando el org.
//
// Siempre scoped al org (multi-tenant): nunca devuelve un cliente de otra org.
// ============================================================================

const digits = (p) => String(p || '').replace(/\D/g, '');

// Dos teléfonos son "el mismo" si coinciden sus últimos 8 dígitos (tolera código
// de país con/sin, 0 inicial, etc.). Si alguno tiene menos de 8 dígitos, exige
// igualdad exacta de los dígitos.
function samePhone(a, b) {
  const da = digits(a), db = digits(b);
  if (!da || !db) return false;
  if (da.length < 8 || db.length < 8) return da === db;
  return da.slice(-8) === db.slice(-8);
}

export async function findClientByPhone({ SB_URL, key, org, telClean }) {
  const H = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const SEL = 'id,name,lista_id';

  // 1. Camino rápido (match exacto o LIKE por últimos 8 dígitos).
  let r = await fetch(
    `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(org)}` +
    `&or=(phone.eq.${encodeURIComponent(telClean)},phone.like.*${encodeURIComponent(telClean.slice(-8))})` +
    `&select=${SEL}&limit=1`,
    { headers: H }
  );
  let rows = r.ok ? await r.json() : [];
  if (Array.isArray(rows) && rows.length) return rows[0];

  // 2. Fallback tolerante al formato (números guardados con espacios/guiones).
  r = await fetch(
    `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(org)}&phone=not.is.null&select=${SEL},phone`,
    { headers: H }
  );
  rows = r.ok ? await r.json() : [];
  const hit = (Array.isArray(rows) ? rows : []).find((c) => samePhone(c.phone, telClean));
  if (hit) return { id: hit.id, name: hit.name, lista_id: hit.lista_id };

  // 3. Teléfonos adicionales (client_phones), match exacto + revalidar org.
  r = await fetch(
    `${SB_URL}/rest/v1/client_phones?phone=eq.${encodeURIComponent(telClean)}&active=eq.true&select=client_id&limit=1`,
    { headers: H }
  );
  const alt = r.ok ? await r.json() : [];
  if (Array.isArray(alt) && alt.length) {
    const r2 = await fetch(
      `${SB_URL}/rest/v1/clients?id=eq.${encodeURIComponent(alt[0].client_id)}` +
      `&org_id=eq.${encodeURIComponent(org)}&select=${SEL}&limit=1`,
      { headers: H }
    );
    const rows2 = r2.ok ? await r2.json() : [];
    if (Array.isArray(rows2) && rows2.length) return rows2[0];
  }

  return null;
}

// api/lead.js — Captación de prospectos del portal (Camino B).
//
// Público (sin auth):
//   GET  ?org=X                     → { captacion: bool }  (para mostrar/ocultar el CTA)
//   POST { org, nombre, tel, ... }  → crea un lead + notifica al distribuidor por email
//
// Admin (Bearer JWT, rol admin — mismo patrón que broadcast.js / whatsapp-connect.js):
//   GET    ?action=list             → lista los prospectos de SU org
//   GET    ?action=config           → { activa: bool }
//   POST   { action:'config', activa } → prende/apaga la captación de SU org
//   POST   { action:'approve', id, lista_id? } → convierte lead → cliente
//   POST   { action:'dismiss', id } → marca el lead como descartado
//
// Genérico multi-tenant: la org del prospecto sale del body (validada/saneada);
// la org del admin sale SIEMPRE del JWT, nunca del body.

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { sendEmail, templates } from './_email.js';
import { readWeb, findSocial, placesSearch, placesConfigured, anthropicJSON, anthropicConfigured } from './_prospecting.js';
import crypto from 'node:crypto';

// Los scrapers de redes (Apify) del enriquecimiento tardan; le damos aire a la
// función. Solo sube el techo — el alta pública de leads sigue respondiendo <2s.
export const config = { maxDuration: 60 };

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// Sourcing por-org (buscar comercios reales del rubro del cliente).
const PLACES_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.internationalPhoneNumber', 'places.websiteUri', 'places.primaryTypeDisplayName',
  'places.rating', 'places.userRatingCount', 'places.businessStatus',
  'nextPageToken',
].join(',');
const SOURCING_TOPE_DEFAULT = 20;   // búsquedas por org por mes (protege el crédito compartido)
const TAMANOS  = ['chico', 'mediano', 'grande', 'sin datos'];
const PRIORIDS = ['alta', 'media', 'baja'];

// Número Pazque (fallback) para la notificación de prospecto por WhatsApp.
const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_LANG     = process.env.WA_BROADCAST_LANG || 'es_AR';

function svcHeaders() {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json' };
}

function sanitizeOrg(v) {
  return String(v || '').replace(/[^a-z0-9_-]/gi, '');
}

// Recorta y limpia un string libre. Longitud tope para evitar payloads gigantes.
function clean(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// Valida el JWT del admin y resuelve { org }. Solo rol admin.
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

// Como resolveAdmin pero acepta una lista de roles (admin + vendedor pueden
// buscar/enriquecer; solo el admin edita los rubros del ICP).
async function resolveMember(req, roles = ['admin']) {
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
  if (!u || !roles.includes(u.role)) return null;
  return { org: u.org_id, role: u.role };
}

// ── Config de sourcing por-org (ICP editable + contador de tope mensual) ─────
function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Lee el ICP de la org. usadas se resetea solo al cambiar de mes.
async function getSourcing(org) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=sourcing&limit=1`,
      { headers: svcHeaders() }
    );
    const s = (r.ok ? await r.json() : [])?.[0]?.sourcing || {};
    const mes = monthKey();
    return {
      rubros: Array.isArray(s.rubros) ? s.rubros.slice(0, 12).map(x => clean(x, 60)).filter(Boolean) : [],
      ciudad: clean(s.ciudad, 80),
      tope:   Number.isInteger(s.tope) ? s.tope : SOURCING_TOPE_DEFAULT,
      mes,
      usadas: s.mes === mes ? (Number(s.usadas) || 0) : 0,   // reset mensual
    };
  } catch {
    return { rubros: [], ciudad: '', tope: SOURCING_TOPE_DEFAULT, mes: monthKey(), usadas: 0 };
  }
}

// Merge parcial: no pisa rubros al incrementar el contador, ni viceversa.
async function setSourcing(org, patch) {
  const cur = await getSourcing(org);
  const next = {
    rubros: 'rubros' in patch ? patch.rubros : cur.rubros,
    ciudad: 'ciudad' in patch ? patch.ciudad : cur.ciudad,
    tope:   'tope'   in patch ? patch.tope   : cur.tope,
    mes:    'mes'    in patch ? patch.mes    : cur.mes,
    usadas: 'usadas' in patch ? patch.usadas : cur.usadas,
  };
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ sourcing: next }),
  });
  return next;
}

// ── Sourcing: buscar comercios reales del rubro del cliente en Google Places ──
// Solo lee de Google e inserta en portal_leads de ESA org (aislado). No contacta
// a nadie: el vendedor abre el WhatsApp con el texto precargado y envía a mano.
async function sourceVenues(org, rubro) {
  if (!placesConfigured()) return { error: 'places_not_configured' };
  const r = clean(rubro, 80);
  if (!r) return { error: 'sin_rubro' };

  const cfg = await getSourcing(org);
  if (cfg.usadas >= cfg.tope) return { error: 'limite', usadas: cfg.usadas, tope: cfg.tope };

  const q = cfg.ciudad ? `${r} en ${cfg.ciudad}, Uruguay` : `${r} en Uruguay`;
  const places = await placesSearch(q, { fields: PLACES_FIELDS });

  // La búsqueda consumió cuota aunque no traiga nada nuevo → cuenta igual.
  const usadas = cfg.usadas + 1;
  await setSourcing(org, { mes: cfg.mes, usadas });

  if (places.length === 0) return { added: 0, found: 0, usadas, tope: cfg.tope };

  // Dedupe POR ORG (otra org puede tener el mismo comercio).
  const existing = await fetch(
    `${SB_URL}/rest/v1/portal_leads?select=place_id&org_id=eq.${encodeURIComponent(org)}&place_id=not.is.null`,
    { headers: svcHeaders() }
  );
  const known = new Set((existing.ok ? await existing.json() : []).map(x => x.place_id));

  const rows = [];
  for (const p of places) {
    const pid = p.id;
    if (!pid || known.has(pid)) continue;
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue; // cerrados fuera
    known.add(pid);
    const nombre = clean(p.displayName?.text, 200);
    if (!nombre) continue;
    const rating = typeof p.rating === 'number' ? `${p.rating}★ (${p.userRatingCount || 0} reseñas)` : '';
    const contexto = [clean(p.formattedAddress, 220), rating].filter(Boolean).join(' · ');
    rows.push({
      org_id:      org,
      nombre,                                                   // nombre del comercio
      tel:         clean(p.internationalPhoneNumber, 40).replace(/[^\d+]/g, '') || null,
      comercio:    clean(p.primaryTypeDisplayName?.text, 120) || r,  // el rubro/tipo
      ciudad:      cfg.ciudad || null,
      mensaje:     clean(contexto, 400) || null,                // dirección + rating
      landing_url: clean(p.websiteUri, 300) || null,
      place_id:    pid,
      origen:      'sourcing',
      utm_source:  'sourcing-google',
      estado:      'nuevo',
    });
  }
  if (rows.length === 0) return { added: 0, found: places.length, usadas, tope: cfg.tope };

  const ins = await fetch(`${SB_URL}/rest/v1/portal_leads`, {
    method: 'POST', headers: { ...svcHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(rows),
  });
  if (!ins.ok) { console.error('[lead] sourcing insert error:', await ins.text()); return { error: 'insert_failed' }; }
  return { added: rows.length, found: places.length, usadas, tope: cfg.tope };
}

// ── Enriquecimiento: Claude entiende el comercio y arma el 1er WhatsApp ──────
// El cliente de Pazque (la distribuidora `orgName`) le vende SUMINISTRO a este
// comercio. El mensaje se presenta como proveedor mayorista, no como Pazque.
async function enrichPortalLead(lead, orgName) {
  if (!anthropicConfigured()) return { error: 'anthropic_not_configured' };

  // Mejor fuente: la web/red que ya conocemos. Si el comercio no tiene nada
  // (ni web ni red en Google), buscamos su IG por nombre y lo verificamos.
  let web = await readWeb(lead.landing_url);
  if (!web) web = await findSocial(lead.nombre, lead.ciudad);
  const compact = {
    comercio: lead.nombre || lead.comercio || '',
    tipo:     lead.comercio || '',      // rubro/tipo del comercio (de Google)
    zona:     lead.ciudad || '',
    contexto: lead.mensaje || '',       // dirección + rating
    sitio:    lead.landing_url || '',
    web:      web || '',
  };

  const system = `Sos el comercial de ${orgName}, una distribuidora mayorista. Tu trabajo es conseguir nuevos COMPRADORES: comercios (cafeterías, restaurantes, hoteles, almacenes, etc.) que le compren mercadería a ${orgName} para su operación.

Te paso un comercio que encontró nuestro agente en un directorio (nombre, tipo, zona, rating). Si el comercio tiene sitio web o redes (Instagram/Facebook), te paso su contenido real en el campo "web": descripción, seguidores, últimos posts. Usalo como tu mejor fuente para entender qué es el comercio, qué vende y qué tamaño tiene. Tu tarea: enriquecerlo para que el vendedor sepa cómo encararlo Y dejarle listo un primer mensaje de WhatsApp ofreciéndole ser su proveedor mayorista.

Reglas:
- Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después.
- Formato exacto: { "rubro": "string", "tamano": "chico"|"mediano"|"grande"|"sin datos", "prioridad": "alta"|"media"|"baja", "angulo": "string", "senales": ["string", ...], "mensaje_wa": "string" }
- "rubro": qué tipo de comercio es, inferido de la web y del tipo declarado (ej: "Cafetería de especialidad", "Restaurante parrilla", "Hotel boutique"). Si no hay pista real, "sin datos".
- "tamano": estimá el tamaño por las señales (cantidad de reseñas, sucursales, movimiento que sugieran los posts). Si no hay señal, "sin datos" — NO adivines.
- "prioridad": qué tan buen COMPRADOR es para ${orgName}. Alta = compra volumen del rubro que la distribuidora provee (mucho movimiento, varias sucursales, alto tránsito). Baja = poca señal o mal fit.
- "angulo": 1-2 frases en español rioplatense (voseo), concretas, sobre POR QUÉ a ESTE comercio le conviene comprarle a ${orgName}, apoyándote en lo que viste de su negocio. Nada genérico.
- "senales": lista corta (máx 4) de datos REALES que usaste (ej: "230 reseñas en Google", "La web muestra 3 sucursales"). Si no hay, vacía. No inventes.
- "mensaje_wa": un PRIMER mensaje de WhatsApp del comercial de ${orgName} para este comercio. TONO: cercano pero profesional, seguro y directo, respetando el tiempo del otro. Reglas duras:
    · Español rioplatense voseo.
    · MÁXIMO 3 líneas cortas.
    · CERO emojis. CERO signos de exclamación. CERO mayúsculas de énfasis.
    · Se presenta en nombre de la distribuidora: "Hola, te escribo de ${orgName}."
    · Una sola observación puntual y VERDADERA del comercio, sacada de la web o del rubro (ej: "vi que tienen la cafetería en el centro"), como quien conoce el rubro. Si NO tenés dato real, no inventes: hacé un mensaje más neutro pero honesto.
    · Ofrecé ser su proveedor mayorista con UNA sola ventaja concreta (surtido, precios de mayorista, entrega, pedir desde un portal sin llamar). No listes todo.
    · Cerrá con una pregunta breve de bajo compromiso, SIN prometer nada fijo. Ej: "¿Te paso el catálogo con precios para que veas?".
    · Que suene a un proveedor serio escribiéndole a un comercio, no a spam. Nada de relleno.
- Usá SOLO lo que te paso (incluido "web"). Nunca inventes datos que no estén ahí.`;

  const parsed = await anthropicJSON({ system, user: 'Comercio:\n' + JSON.stringify(compact, null, 2) });
  if (!parsed) return { error: 'enrich_failed' };
  return {
    enriquecimiento: {
      rubro:      clean(parsed.rubro, 120) || 'sin datos',
      tamano:     TAMANOS.includes(parsed.tamano) ? parsed.tamano : 'sin datos',
      prioridad:  PRIORIDS.includes(parsed.prioridad) ? parsed.prioridad : 'media',
      angulo:     clean(parsed.angulo, 400),
      senales:    Array.isArray(parsed.senales) ? parsed.senales.slice(0, 4).map(s => clean(s, 160)).filter(Boolean) : [],
      mensaje_wa: clean(parsed.mensaje_wa, 700),
    },
  };
}

// Lee la config de captación. { activa, notify_phone, notify_email }.
async function getCaptacion(org) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=captacion&limit=1`,
      { headers: svcHeaders() }
    );
    if (!r.ok) return { activa: false, notify_phone: null, notify_email: null };
    const c = (await r.json())?.[0]?.captacion || {};
    return { activa: !!c.activa, notify_phone: c.notify_phone || null, notify_email: c.notify_email || null };
  } catch { return { activa: false, notify_phone: null, notify_email: null }; }
}

// Merge parcial: lee la config actual y sobreescribe solo los campos del patch.
// Así togglear el flag no borra el teléfono/mail, ni viceversa.
async function setCaptacion(org, patch) {
  const cur = await getCaptacion(org);
  const next = {
    activa:       'activa'       in patch ? !!patch.activa                 : cur.activa,
    notify_phone: 'notify_phone' in patch ? (patch.notify_phone || null)   : cur.notify_phone,
    notify_email: 'notify_email' in patch ? (patch.notify_email || null)   : cur.notify_email,
  };
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ captacion: next }),
  });
  return next;
}

// Fuente de campaña del prospecto, en texto corto (para el WhatsApp/email).
function fuenteOf(lead) {
  if (lead.utm_source || lead.utm_campaign)
    return [lead.utm_source, lead.utm_campaign].filter(Boolean).join(' · ');
  if (lead.fbclid) return 'Meta Ads';
  if (lead.gclid)  return 'Google Ads';
  if (lead.referrer) { try { return new URL(lead.referrer).hostname.replace(/^www\./, ''); } catch { return lead.referrer; } }
  return 'Directo';
}

// Saneado para parámetros de plantilla de WhatsApp: Meta rechaza saltos de línea,
// tabs y más de 4 espacios seguidos dentro de un parámetro. Nunca vacío.
function waParam(v, fallback = '-') {
  const s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();
  return s || fallback;
}

// Notifica al distribuidor por WhatsApp que entró un prospecto (best-effort).
// Sender: su propia WABA si conectó WhatsApp y la plantilla pazque_prospecto está
// APROBADA en su cuenta; si no, el número de Pazque (fallback, nunca rompe).
async function notifyWhatsApp(org, lead, notifyPhone) {
  const to = String(notifyPhone || '').replace(/\D/g, '');
  if (!to) return;   // sin teléfono configurado → no hay a quién avisar

  let sender = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=whatsapp_sender&limit=1`,
      { headers: svcHeaders() }
    );
    if (r.ok) sender = (await r.json())?.[0]?.whatsapp_sender || null;
  } catch { /* usa fallback Pazque */ }

  const useOrg = !!(sender?.phone_id && sender?.token && sender?.prospecto_status === 'APPROVED');
  const phoneId = useOrg ? sender.phone_id : WA_PHONE_ID;
  const token   = useOrg ? sender.token   : WA_TOKEN;
  if (!phoneId || !token) return;   // mensajería no configurada

  const detalle = [lead.comercio, lead.ciudad, fuenteOf(lead)].filter(Boolean).join(' · ');
  const params = [waParam(lead.nombre), waParam(lead.tel), waParam(detalle)];

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'pazque_prospecto',
          language: { code: WA_LANG },
          components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
        },
      }),
    });
    if (!r.ok) console.warn('[lead] WhatsApp notify failed (non-fatal):', (await r.text()).slice(0, 200));
  } catch (e) {
    console.warn('[lead] WhatsApp notify threw (non-fatal):', e.message);
  }
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action || '';

  // ── Rutas de admin (requieren JWT) ───────────────────────────────────────
  const isAdminAction =
    action === 'list' || action === 'approve' || action === 'dismiss' || action === 'config' || action === 'contacted';

  if (isAdminAction) {
    const admin = await resolveAdmin(req);
    if (!admin) return res.status(401).json({ error: 'No autorizado' });
    const org = admin.org;

    if (req.method === 'GET' && action === 'list') {
      const r = await fetch(
        `${SB_URL}/rest/v1/portal_leads?org_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500`,
        { headers: svcHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: 'No se pudieron leer los prospectos' });
      return res.status(200).json({ leads: await r.json() });
    }

    if (req.method === 'GET' && action === 'config') {
      return res.status(200).json(await getCaptacion(org));
    }

    if (req.method === 'POST' && action === 'config') {
      const patch = {};
      if ('activa' in (req.body || {}))       patch.activa = !!req.body.activa;
      if ('notify_phone' in (req.body || {})) patch.notify_phone = clean(req.body.notify_phone, 40).replace(/\D/g, '') || null;
      if ('notify_email' in (req.body || {})) {
        const em = clean(req.body.notify_email, 160).toLowerCase();
        // Validación básica de email; vacío = usar el mail de pedidos (fallback).
        patch.notify_email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? em : null;
      }
      const next = await setCaptacion(org, patch);
      return res.status(200).json({ ok: true, ...next });
    }

    if (req.method === 'POST' && action === 'dismiss') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });
      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'descartado', updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }

    // Marcar como contactado. Se dispara solo cuando el admin abre WhatsApp para
    // escribirle (no hay botón aparte). Filtramos por estado=nuevo para NO pisar
    // un 'convertido' o 'descartado' si vuelve a tocar WhatsApp desde el historial.
    if (req.method === 'POST' && action === 'contacted') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });
      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}&estado=eq.nuevo`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'contactado', updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && action === 'approve') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });

      // Traer el lead, scoped a la org del admin (nunca de otra org).
      const lr = await fetch(
        `${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
        { headers: svcHeaders() }
      );
      const lead = (lr.ok ? await lr.json() : [])?.[0];
      if (!lead) return res.status(404).json({ error: 'Prospecto no encontrado' });
      if (lead.converted_client_id) {
        return res.status(200).json({ ok: true, already: true, client_id: lead.converted_client_id });
      }

      // Crear el cliente con el mismo esquema que usa el vendedor (api/vendedor.js).
      const phone = clean(lead.tel, 40).replace(/\D/g, '');
      const row = {
        id:         crypto.randomUUID(),
        name:       clean(lead.nombre, 120) || 'Sin nombre',
        type:       'Otro',
        phone,
        contact:    clean(lead.comercio, 120),
        contacto:   clean(lead.comercio, 120),
        ciudad:     clean(lead.ciudad, 120),
        cond_pago:  'credito_30',
        org_id:     org,                    // ← del JWT, nunca del body
        created_at: new Date().toISOString(),
      };
      const lista_id = clean(req.body?.lista_id, 60);
      if (lista_id) row.lista_id = lista_id;

      const ins = await fetch(`${SB_URL}/rest/v1/clients`, {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!ins.ok) {
        console.error('[lead] approve → client insert error:', await ins.text());
        return res.status(502).json({ error: 'No se pudo crear el cliente' });
      }
      const created = (await ins.json())?.[0] || row;

      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'convertido', converted_client_id: created.id, updated_at: new Date().toISOString() }),
      });

      return res.status(200).json({ ok: true, client: { id: created.id, name: created.name, phone: created.phone } });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ── Rutas de sourcing por-org (admin + vendedor; editar ICP = solo admin) ─
  const isMemberAction =
    action === 'source' || action === 'enrich' || action === 'sourcing-config';

  if (isMemberAction) {
    const member = await resolveMember(req, ['admin', 'vendedor']);
    if (!member) return res.status(401).json({ error: 'No autorizado' });
    const org = member.org;

    if (req.method === 'GET' && action === 'sourcing-config') {
      return res.status(200).json(await getSourcing(org));
    }

    if (req.method === 'POST' && action === 'sourcing-config') {
      if (member.role !== 'admin') return res.status(403).json({ error: 'Solo el admin edita los rubros' });
      const patch = {};
      if (Array.isArray(req.body?.rubros))
        patch.rubros = req.body.rubros.slice(0, 12).map(x => clean(x, 60)).filter(Boolean);
      if ('ciudad' in (req.body || {})) patch.ciudad = clean(req.body.ciudad, 80);
      const next = await setSourcing(org, patch);
      return res.status(200).json({ ok: true, ...next });
    }

    if (req.method === 'POST' && action === 'source') {
      const out = await sourceVenues(org, req.body?.rubro);
      if (out.error === 'places_not_configured') return res.status(503).json({ error: 'Búsqueda no configurada todavía.' });
      if (out.error === 'sin_rubro')             return res.status(400).json({ error: 'Elegí un rubro para buscar.' });
      if (out.error === 'limite')
        return res.status(429).json({ error: `Llegaste al tope de ${out.tope} búsquedas este mes.`, usadas: out.usadas, tope: out.tope });
      if (out.error) return res.status(502).json({ error: 'No se pudo buscar. Probá de nuevo.' });
      return res.status(200).json({ ok: true, ...out });
    }

    if (req.method === 'POST' && action === 'enrich') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const lr = await fetch(
        `${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
        { headers: svcHeaders() }
      );
      const lead = (lr.ok ? await lr.json() : [])?.[0];
      if (!lead) return res.status(404).json({ error: 'Prospecto no encontrado' });

      const orgRes = await fetch(
        `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=name&limit=1`,
        { headers: svcHeaders() }
      );
      const orgName = (orgRes.ok ? await orgRes.json() : [])?.[0]?.name || 'nuestra distribuidora';

      const out = await enrichPortalLead(lead, orgName);
      if (out.error === 'anthropic_not_configured') return res.status(503).json({ error: 'Enriquecimiento no configurado todavía.' });
      if (out.error) return res.status(502).json({ error: 'No se pudo enriquecer. Probá de nuevo.' });

      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ enriquecimiento: out.enriquecimiento, enriquecido_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true, enriquecimiento: out.enriquecimiento });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ── Ruta pública: estado del flag (para decidir si mostrar el CTA) ────────
  if (req.method === 'GET') {
    const org = sanitizeOrg(req.query?.org) || 'aryes';
    return res.status(200).json(await getCaptacion(org));
  }

  // ── Ruta pública: crear prospecto ────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Fail-closed: si el limiter no responde, no dejamos spamear la tabla.
  if (!(await checkRateLimit('lead:' + ip, 600, 5, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  const org = sanitizeOrg(req.body?.org) || 'aryes';

  // La captación tiene que estar activa para esa org (server-authoritative:
  // no alcanza con que el front muestre el form; se valida acá también).
  const cap = await getCaptacion(org);
  if (!cap.activa) return res.status(403).json({ error: 'Captación no disponible' });

  const nombre   = clean(req.body?.nombre, 120);
  const tel      = clean(req.body?.tel, 40);
  const comercio = clean(req.body?.comercio, 160);
  const ciudad   = clean(req.body?.ciudad, 120);
  const telDigits = tel.replace(/\D/g, '');
  if (!nombre) return res.status(400).json({ error: 'Ingresá tu nombre' });
  if (telDigits.length < 8) return res.status(400).json({ error: 'Ingresá un WhatsApp válido' });
  if (!comercio) return res.status(400).json({ error: 'Ingresá el nombre de tu comercio' });
  if (!ciudad) return res.status(400).json({ error: 'Ingresá tu ciudad' });

  const lead = {
    org_id:       org,
    nombre,
    tel:          telDigits,
    comercio,
    ciudad,
    mensaje:      clean(req.body?.mensaje, 500) || null,
    utm_source:   clean(req.body?.utm_source, 120) || null,
    utm_medium:   clean(req.body?.utm_medium, 120) || null,
    utm_campaign: clean(req.body?.utm_campaign, 160) || null,
    fbclid:       clean(req.body?.fbclid, 255) || null,
    gclid:        clean(req.body?.gclid, 255) || null,
    referrer:     clean(req.body?.referrer, 255) || null,
    landing_url:  clean(req.body?.landing_url, 255) || null,
    estado:       'nuevo',
  };

  const ins = await fetch(`${SB_URL}/rest/v1/portal_leads`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(lead),
  });
  if (!ins.ok) {
    console.error('[lead] insert error:', await ins.text());
    return res.status(500).json({ error: 'No pudimos guardar tus datos. Probá de nuevo.' });
  }

  // Notificar al distribuidor por email (best-effort, no bloquea la respuesta).
  // Destino: el mail propio de prospectos si se configuró, si no el de pedidos.
  try {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=order_notify_email,name&limit=1`,
      { headers: svcHeaders() }
    );
    const orow = (orgRes.ok ? await orgRes.json() : [])?.[0];
    const dest = cap.notify_email || orow?.order_notify_email;
    if (dest) {
      const tpl = templates.nuevoProspecto(lead, orow?.name || 'Pazque');
      await sendEmail({ to: dest, subject: tpl.subject, html: tpl.html });
    }
  } catch (e) {
    console.warn('[lead] notify email failed (non-fatal):', e.message);
  }

  // Notificar por WhatsApp al teléfono configurado (best-effort, no bloquea).
  await notifyWhatsApp(org, lead, cap.notify_phone);

  return res.status(200).json({ ok: true });
}

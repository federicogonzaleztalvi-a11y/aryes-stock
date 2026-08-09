// api/owner.js — Consola privada del DUEÑO de Pazque (Federico).
//
// Esta es la ÚNICA API que cruza la frontera multi-tenant: ve prospectos de
// TODA la plataforma (pazque_leads), no de una org. Por eso NO usa el sistema
// de roles por-org (admin/operador/vendedor) que protege a Eric — tiene su
// propio login, aislado.
//
// Login SIN contraseña (como Shopify/Amazon, no una clave compartida):
//   1) request-code  → manda un código de 6 dígitos al mail del dueño.
//   2) verify-code   → valida el código y devuelve un TOKEN de sesión (30 días).
//   3) list/update   → requieren ese token en el header `x-owner-token`.
//
// La sesión persiste 30 días por dispositivo (el token se guarda en el browser),
// así que el código se pide UNA vez por aparato, no cada vez.
//
//   POST { action:'request-code', email }        → { ok:true }  (genérico)
//   POST { action:'verify-code',  email, code }  → { ok:true, token, expiresAt }
//   POST { action:'list' }                        → { ok:true, leads:[...] }
//   POST { action:'update', id, estado?, notas? } → { ok:true }
//   POST { action:'enrich', id }                  → { ok:true, enriquecimiento:{...} }
//   POST { action:'source', query? }              → { ok:true, added, found }
//
// Peldaño 1b (enrich): un agente que LEE lo que el prospecto ya dejó y sugiere
// rubro, tamaño, prioridad, ángulo de venta y un mensaje de WhatsApp listo. Solo
// lee y propone; no manda nada. El resultado queda cacheado en la fila.
//
// Fase B (source): busca distribuidoras uruguayas reales en Google Places y las
// mete en pazque_leads (origen='sourcing', dedupe por place_id). No contacta a
// nadie: Federico abre el WhatsApp con el texto precargado y envía a mano.
//
// El embudo del PRODUCTO (portal_leads / api/lead.js) NO se toca acá.

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { sendEmail, templates } from './_email.js';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const APIFY_TOKEN = process.env.APIFY_TOKEN;   // opcional: lee IG/FB reales pasando el muro de login

// Los scrapers de redes (Apify) tardan; le damos aire a la función serverless.
// Solo sube el techo — las demás acciones siguen respondiendo en <2s.
export const config = { maxDuration: 60 };

// Único mail autorizado a entrar. Default: la casilla de Federico. Se puede
// sobreescribir con OWNER_EMAIL (por si algún día cambia), pero no hace falta.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'federico@pazque.com').trim().toLowerCase();

const CODE_TTL_MIN = 10;                 // el código vence a los 10 minutos
const SESSION_DAYS = 30;                 // la sesión dura 30 días por dispositivo
const MAX_CODE_ATTEMPTS = 5;             // intentos por código antes de invalidarlo
const FOLLOW_UP_DAYS = 3;                // cadencia por defecto entre toques de seguimiento

const ESTADOS = ['nuevo', 'contactado', 'demo', 'convertido', 'descartado'];

function svcHeaders(extra = {}) {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json', ...extra };
}

function sha256(s) { return createHash('sha256').update(String(s)).digest('hex'); }

// Comparación en tiempo constante de dos hashes hex del mismo largo.
function hashEq(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function clean(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// ── Sesión: valida el token del header contra owner_sessions ────────────────
async function sessionOk(req) {
  const token = req.headers['x-owner-token'];
  if (!token) return false;
  const th = sha256(token);
  const r = await fetch(
    `${SB_URL}/rest/v1/owner_sessions?token_hash=eq.${encodeURIComponent(th)}&select=token_hash,expires_at`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return false;
  const rows = await r.json();
  const row = rows[0];
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  // Refrescar last_seen (best-effort, no bloquea).
  fetch(`${SB_URL}/rest/v1/owner_sessions?token_hash=eq.${encodeURIComponent(th)}`, {
    method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => {});
  return true;
}

// ── Lectura del sitio web / redes del prospecto ─────────────────────────────
// Trae el texto visible de la web de la distribuidora (si dejó una) para que el
// enriquecimiento sea sobre datos REALES del negocio, no genérico. Best-effort:
// timeout corto, solo HTML, recorta a lo esencial. Si falla, devuelve ''.
//
// Instagram/Facebook bloquean a los bots con un muro de login, así que el <body>
// no sirve. Pero ambos exponen a los buscadores las etiquetas og: (título +
// descripción, y en IG a veces seguidores/posts). Para esos hosts usamos SOLO
// esas etiquetas; para una web normal, og: + el texto de la página.

// Extrae el content de un <meta property="X"> o <meta name="X"> (atributos en
// cualquier orden). Devuelve '' si no está.
function metaContent(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + k + '["\']', 'i');
  return (html.match(re1) || html.match(re2) || [])[1] || '';
}

// Descubre el Instagram/Facebook que el propio sitio LINKEA (dato verdadero: es
// la red que ellos mismos publican). Salta links que no son de perfil.
function firstSocialLink(html, network) {
  if (network === 'instagram') {
    const skip = ['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'about', 'legal', 'privacy', 'developer'];
    const re = /instagram\.com\/([A-Za-z0-9._]{2,30})/ig; let m;
    while ((m = re.exec(html))) { const u = m[1]; if (!skip.includes(u.toLowerCase())) return `https://instagram.com/${u}`; }
    return '';
  }
  const skip = ['sharer', 'sharer.php', 'plugins', 'login', 'dialog', 'tr', 'profile.php', 'people'];
  const re = /facebook\.com\/([A-Za-z0-9.-]{2,60})/ig; let m;
  while ((m = re.exec(html))) { const u = m[1]; if (!skip.includes(u.toLowerCase())) return `https://facebook.com/${u}`; }
  return '';
}

// Lee un sitio y devuelve { text, ig, fb }. En IG/FB el body es muro de login →
// solo og:. En una web normal: og: + texto + los links de redes que publica.
async function fetchSite(url) {
  try {
    const u = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const host = (() => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const social = /(^|\.)(instagram\.com|facebook\.com|fb\.com|m\.facebook\.com)$/i.test(host);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(u, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PazqueBot/1.0)' },
    });
    clearTimeout(t);
    if (!r.ok) return { text: '', ig: '', fb: '' };
    if (!/text\/html|text\/plain/i.test(r.headers.get('content-type') || '')) return { text: '', ig: '', fb: '' };
    let html = (await r.text()).slice(0, 200000);
    // Etiquetas que las redes/sitios exponen a los buscadores (resumen del negocio).
    const head = [metaContent(html, 'og:title'), metaContent(html, 'og:description'), metaContent(html, 'description')]
      .filter(Boolean).join(' · ');
    // En IG/FB el body es un muro de login: nos quedamos solo con las og:.
    if (social) return { text: head.slice(0, 1200), ig: '', fb: '' };
    // Redes que el propio sitio linkea (fuente confiable de su IG/FB).
    const ig = firstSocialLink(html, 'instagram');
    const fb = firstSocialLink(html, 'facebook');
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    return { text: (head + ' ' + html).replace(/\s+/g, ' ').trim().slice(0, 3500), ig, fb };
  } catch { return { text: '', ig: '', fb: '' }; }
}

// ── Lectura profunda de redes vía Apify (opcional) ──────────────────────────
// Apify tiene scrapers que SÍ entran a Instagram/Facebook pasando el muro de
// login. Lo usamos on-demand, un perfil por vez, para que el enriquecimiento
// tenga la bio + posts reales del negocio. Si no hay token, no es red social o
// el actor falla/tarda, devuelve '' y el enriquecimiento cae en fetchSiteText.
async function apifyRun(actorId, input, timeoutSec = 40) {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`
    + `?token=${encodeURIComponent(APIFY_TOKEN)}&timeout=${timeoutSec}&maxItems=1`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), (timeoutSec + 8) * 1000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    clearTimeout(t);
    if (!r.ok) { console.warn('[owner] apify error:', actorId, r.status); return []; }
    const items = await r.json();
    return Array.isArray(items) ? items : [];
  } catch (e) { clearTimeout(t); console.warn('[owner] apify fail:', actorId, e.message); return []; }
}

// Da formato al perfil de IG que devuelve Apify (bio, seguidores, últimos posts).
function fmtIG(p) {
  const posts = Array.isArray(p.latestPosts)
    ? p.latestPosts.slice(0, 6).map(x => x?.caption).filter(Boolean).join(' | ') : '';
  return [
    p.fullName && `Nombre: ${p.fullName}`,
    p.username && `IG: @${p.username}`,
    p.biography && `Bio: ${p.biography}`,
    p.followersCount != null && `Seguidores: ${p.followersCount}`,
    p.postsCount != null && `Posts: ${p.postsCount}`,
    p.businessCategoryName && `Categoría: ${p.businessCategoryName}`,
    posts && `Últimos posts: ${posts}`,
  ].filter(Boolean).join(' · ').slice(0, 2500);
}

// Normaliza texto para comparar: sin acentos, minúsculas, solo alfanumérico.
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// ¿El perfil se corresponde DE VERDAD con este negocio? Exige que el nombre
// aparezca en el perfil (la mayoría de sus palabras) y, si tenemos ciudad, que
// la ciudad también esté. Estricto a propósito: antes que pegarle a la cuenta
// equivocada, devolvemos '' (nada de humo).
function profileMatches(p, name, city) {
  const hay = norm([p.fullName, p.username, p.biography, p.businessCategoryName, p.businessAddress]
    .filter(Boolean).join(' '));
  const tokens = norm(name).split(' ').filter(t => t.length >= 3);
  if (!tokens.length) return false;
  const hits = tokens.filter(t => hay.includes(t)).length;
  if (hits < Math.ceil(tokens.length * 0.6)) return false;
  const c = norm(city);
  return !c || hay.includes(c);
}

async function scrapeSocial(url) {
  if (!APIFY_TOKEN || !url) return '';
  let host = '';
  try { host = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); }
  catch { return ''; }

  // Instagram: username del path → profile scraper.
  if (/(^|\.)instagram\.com$/i.test(host)) {
    const user = (String(url).match(/instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1];
    const skip = ['p', 'reel', 'reels', 'explore', 'stories', 'tv'];
    if (!user || skip.includes(user.toLowerCase())) return '';
    const p = (await apifyRun('apify~instagram-profile-scraper', { usernames: [user] }))[0];
    if (!p) return '';
    return fmtIG(p);
  }

  // Facebook: page scraper por URL.
  if (/(^|\.)(facebook\.com|fb\.com)$/i.test(host)) {
    const p = (await apifyRun('apify~facebook-pages-scraper', { startUrls: [{ url }], maxPosts: 0 }))[0];
    if (!p) return '';
    return [
      p.title && `Nombre: ${p.title}`,
      p.intro && `Intro: ${p.intro}`,
      p.categories && `Categorías: ${[].concat(p.categories).join(', ')}`,
      p.likes != null && `Likes: ${p.likes}`,
      p.info && `Info: ${[].concat(p.info).join(' ')}`,
    ].filter(Boolean).join(' · ').slice(0, 2500);
  }

  return ''; // no es red social → lo maneja fetchSite
}

// Lee lo mejor que haya: si la URL YA es IG/FB, a fondo directo; si es web,
// su texto + el IG/FB que ELLOS linkean (leído a fondo con Apify).
async function readWeb(url) {
  if (!url) return '';
  const direct = await scrapeSocial(url);
  if (direct) return direct;
  const site = await fetchSite(url);
  let social = '';
  if (site.ig) social = await scrapeSocial(site.ig);
  if (!social && site.fb) social = await scrapeSocial(site.fb);
  return [site.text, social && `Redes del negocio: ${social}`]
    .filter(Boolean).join('\n').slice(0, 4000);
}

// Último recurso: el negocio NO tiene web ni red publicada. Buscamos su
// Instagram por nombre y SOLO lo usamos si el perfil se VERIFICA (nombre +
// ciudad coinciden). Antes que un dato falso, nada.
async function findSocial(name, city) {
  if (!APIFY_TOKEN || !name) return '';
  const found = await apifyRun('apify~instagram-search-scraper', { search: name, searchType: 'user' });
  const users = [];
  for (const it of found) {
    if (it?.username) users.push(it.username);
    if (Array.isArray(it?.users)) for (const u of it.users) if (u?.username) users.push(u.username);
  }
  for (const user of users.slice(0, 3)) {
    const p = (await apifyRun('apify~instagram-profile-scraper', { usernames: [user] }))[0];
    if (p && profileMatches(p, name, city)) return fmtIG(p);
  }
  return '';
}

// ── Enriquecimiento: Claude infiere rubro/tamaño/prioridad/ángulo ───────────
// Usa lo que el prospecto dejó (nombre, empresa, rubro, mensaje) MÁS el contenido
// real de su sitio web o red social cuando tiene uno. Si no hay señal, "sin datos".
const TAMANOS  = ['chico', 'mediano', 'grande', 'sin datos'];
const PRIORIDS = ['alta', 'media', 'baja'];

async function enrichLead(lead) {
  if (!ANTHROPIC_KEY) return { error: 'anthropic_not_configured' };

  // Datos reales del negocio (no genérico): leemos su web y el IG/FB que linkea a
  // fondo con Apify. Si no tiene nada, buscamos su IG por nombre y lo verificamos.
  let web = await readWeb(lead.landing_url);
  if (!web) web = await findSocial(lead.empresa || lead.nombre, '');

  const compact = {
    nombre:   lead.nombre || '',
    empresa:  lead.empresa || '',
    rubro_declarado: lead.rubro || '',
    mensaje:  lead.mensaje || '',
    sitio:    lead.landing_url || '',
    web:      web || '',
    llegó_por: [lead.utm_source, lead.utm_campaign].filter(Boolean).join(' / ') || 'directo',
  };

  const system = `Sos un SDR senior (sales development) de Pazque, un SaaS B2B para distribuidoras mayoristas de LATAM. Pazque le da a la distribuidora un portal donde sus clientes hacen pedidos solos (en vez de por WhatsApp uno por uno), catálogo con fotos y precios, y toma de pedidos por voz/foto.

Te paso los datos de un prospecto (una distribuidora). Puede venir de dos formas: (a) pidió una demo y dejó un mensaje, o (b) lo encontró nuestro agente en un directorio (nombre/rubro/zona/rating). Además, si la distribuidora tiene sitio web o redes (Instagram/Facebook), te paso su contenido real en el campo "web" — puede ser el texto del sitio o el resumen de su perfil de redes (descripción, seguidores). Usalo como tu mejor fuente para entender QUÉ distribuye, a quién y qué tamaño tiene. Tu tarea: enriquecerlo para que el dueño de Pazque sepa cómo encararlo Y dejarle listo un primer mensaje de WhatsApp.

Reglas:
- Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después.
- Formato exacto: { "rubro": "string", "tamano": "chico"|"mediano"|"grande"|"sin datos", "prioridad": "alta"|"media"|"baja", "angulo": "string", "senales": ["string", ...], "mensaje_wa": "string" }
- "rubro": qué distribuye, inferido del sitio web y del rubro declarado, normalizado (ej: "Distribuidora de bebidas y bebidas alcohólicas"). Priorizá lo que diga la web por sobre el rubro genérico de Google. Si no hay pista real, poné "sin datos".
- "tamano": estimá el tamaño por las señales (líneas de producto, cantidad de reseñas, menciones de sucursales/flota/vendedores en la web). Si no hay ninguna señal, poné "sin datos" — NO adivines.
- "prioridad": qué tan buen fit es para Pazque. Alta = tiene el dolor exacto que Pazque resuelve (muchos pedidos por WhatsApp, muchos clientes/revendedores, varios vendedores). Baja = poca señal o mal fit.
- "angulo": 1-2 frases en español rioplatense (voseo), concretas, sobre POR QUÉ Pazque le sirve A ESTA distribuidora puntual, apoyándote en lo que viste de su negocio. Nada genérico.
- "senales": lista corta (máx 4) de los datos REALES que usaste para decidir (ej: "La web lista 200+ productos de almacén", "128 reseñas en Google"). Si no hay, dejala vacía. No inventes señales.
- "mensaje_wa": un PRIMER mensaje de WhatsApp para que Federico (dueño de Pazque) le escriba a esta distribuidora. TONO: cercano pero profesional, del registro de founders top-tech (Sophia Amoruso, Amazon) — seguro, directo, sin adornos, respetando el tiempo del otro. Reglas duras:
    · Español rioplatense voseo.
    · MÁXIMO 3 líneas cortas. Menos es más.
    · CERO emojis. CERO signos de exclamación. CERO MAYÚSCULAS de énfasis.
    · Se presenta seco y claro: "Hola Diego, soy Federico, fundador de Pazque."
    · Una sola observación puntual y VERDADERA del negocio de ellos, sacada de la web o del rubro (ej: "vi que distribuís bebidas a comercios en Montevideo"), como quien entiende el rubro, no como quien adula. Si NO tenés dato real del negocio (sin web y rubro genérico), no inventes una observación: hacé un mensaje más neutro pero honesto.
    · Una frase de valor concreta: que sus clientes hagan los pedidos solos desde un portal, en vez de que su equipo los reciba uno por uno por WhatsApp.
    · Cierre con una pregunta breve y de bajo compromiso, SIN prometer una duración fija (nada de "en 20 minutos"). Ej: "¿Te sirve que te muestre cómo se vería para tu operación?".
    · Que suene a un fundador seguro escribiéndole a un par, no a un vendedor. Nada de relleno, nada de "espero que estés bien", nada de folleto.
- Usá SOLO lo que te paso (incluido el contenido de "web" si viene). Nunca inventes datos que no estén ahí: si algo no lo sabés, no lo afirmes.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: 'Prospecto:\n' + JSON.stringify(compact, null, 2) }],
      }),
    });
    if (!r.ok) { console.warn('[owner] enrich anthropic error:', r.status); return { error: 'anthropic_error' }; }
    const d = await r.json();
    let text = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    const parsed = JSON.parse(text);

    // Normalizamos a valores conocidos (no confiamos ciegamente en el modelo).
    const out = {
      rubro:      clean(parsed.rubro, 120) || 'sin datos',
      tamano:     TAMANOS.includes(parsed.tamano) ? parsed.tamano : 'sin datos',
      prioridad:  PRIORIDS.includes(parsed.prioridad) ? parsed.prioridad : 'media',
      angulo:     clean(parsed.angulo, 400),
      senales:    Array.isArray(parsed.senales) ? parsed.senales.slice(0, 4).map(s => clean(s, 160)).filter(Boolean) : [],
      mensaje_wa: clean(parsed.mensaje_wa, 700),
    };
    return { enriquecimiento: out };
  } catch (e) {
    console.warn('[owner] enrich parse error:', e.message);
    return { error: 'enrich_failed' };
  }
}

// ── Sourcing outbound: buscar distribuidoras reales en Google Places ────────
// SOLO lee de Google e inserta en NUESTRA tabla (pazque_leads). No contacta a
// nadie. Federico decide a quién escribirle y lo hace a mano por WhatsApp.
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
// Pedimos solo los campos que usamos (el field mask define el costo del SKU).
const PLACES_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.internationalPhoneNumber', 'places.websiteUri', 'places.primaryTypeDisplayName',
  'places.rating', 'places.userRatingCount', 'places.businessStatus',
  'nextPageToken',
].join(',');

// Trae hasta ~2 páginas (40 resultados) para una búsqueda. Google pagina de a 20.
async function placesSearch(query) {
  const results = [];
  let pageToken = null;
  for (let page = 0; page < 2; page++) {
    const body = { textQuery: query, regionCode: 'UY', languageCode: 'es' };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': PLACES_FIELDS,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.warn('[owner] places error:', r.status, await r.text().catch(() => '')); break; }
    const d = await r.json();
    for (const p of (d.places || [])) results.push(p);
    pageToken = d.nextPageToken || null;
    if (!pageToken) break;
    // Google exige una pausa corta antes de usar el nextPageToken.
    await new Promise(res => setTimeout(res, 1600));
  }
  return results;
}

// Busca distribuidoras, descarta las que ya tenemos (por place_id) y las inserta.
// Devuelve cuántas nuevas entraron.
async function sourceDistributors(query) {
  if (!GOOGLE_PLACES_KEY) return { error: 'places_not_configured' };
  const q = clean(query, 160) || 'distribuidoras mayoristas en Uruguay';

  const places = await placesSearch(q);
  if (places.length === 0) return { added: 0, found: 0 };

  // Traemos los place_id que ya tenemos para no duplicar.
  const existing = await fetch(
    `${SB_URL}/rest/v1/pazque_leads?select=place_id&place_id=not.is.null`,
    { headers: svcHeaders() }
  );
  const known = new Set((existing.ok ? await existing.json() : []).map(r => r.place_id));

  const rows = [];
  for (const p of places) {
    const pid = p.id;
    if (!pid || known.has(pid)) continue;
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue; // saltamos cerrados / temporalmente cerrados
    known.add(pid); // evita duplicados dentro del mismo lote
    const nombre = clean(p.displayName?.text, 200);
    if (!nombre) continue;
    // Guardamos dirección + señal de tamaño (rating y reseñas) como contexto del lead.
    const rating = typeof p.rating === 'number'
      ? `${p.rating}★ (${p.userRatingCount || 0} reseñas)` : '';
    const contexto = [clean(p.formattedAddress, 220), rating].filter(Boolean).join(' · ');
    rows.push({
      nombre,                                   // en sourcing el "nombre" es la distribuidora
      empresa: nombre,
      tel: clean(p.internationalPhoneNumber, 40) || null,
      rubro: clean(p.primaryTypeDisplayName?.text, 120) || null,
      mensaje: clean(contexto, 300) || null,   // dirección + rating como contexto
      landing_url: clean(p.websiteUri, 300) || null,
      place_id: pid,
      origen: 'sourcing',
      utm_source: 'sourcing-google',
      estado: 'nuevo',
    });
  }
  if (rows.length === 0) return { added: 0, found: places.length };

  const ins = await fetch(`${SB_URL}/rest/v1/pazque_leads`, {
    method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(rows),
  });
  if (!ins.ok) { console.error('[owner] sourcing insert error:', await ins.text()); return { error: 'insert_failed' }; }
  return { added: rows.length, found: places.length };
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const action = clean(req.body?.action, 20);

  // ── Paso 1: pedir código ──────────────────────────────────────────────
  if (action === 'request-code') {
    // Rate-limit por IP: frena que alguien spamee el mail del dueño.
    if (!(await checkRateLimit('owner-code:' + ip, 600, 5, { failClosed: true })))
      return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });

    const email = clean(req.body?.email, 160).toLowerCase();
    // Respuesta SIEMPRE genérica: no revelamos cuál es el mail de dueño.
    if (email !== OWNER_EMAIL) return res.status(200).json({ ok: true });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const row = {
      email,
      code_hash: sha256(code),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(),
    };
    const ins = await fetch(`${SB_URL}/rest/v1/owner_login_codes`, {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(row),
    });
    if (!ins.ok) {
      console.error('[owner] code insert error:', await ins.text());
      return res.status(500).json({ error: 'No pudimos generar el código. Probá de nuevo.' });
    }
    try {
      const tpl = templates.ownerLoginCode(code, CODE_TTL_MIN);
      await sendEmail({ to: OWNER_EMAIL, subject: tpl.subject, html: tpl.html });
    } catch (e) {
      console.warn('[owner] code email failed:', e.message);
    }
    return res.status(200).json({ ok: true });
  }

  // ── Paso 2: verificar código → sesión ─────────────────────────────────
  if (action === 'verify-code') {
    if (!(await checkRateLimit('owner-verify:' + ip, 600, 10, { failClosed: true })))
      return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });

    const email = clean(req.body?.email, 160).toLowerCase();
    const code  = clean(req.body?.code, 6).replace(/\D/g, '');
    if (email !== OWNER_EMAIL || code.length !== 6)
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });

    // Traemos el código más reciente, vivo, para ese mail.
    const q = await fetch(
      `${SB_URL}/rest/v1/owner_login_codes?email=eq.${encodeURIComponent(email)}&consumed=eq.false&order=created_at.desc&limit=1`,
      { headers: svcHeaders() }
    );
    const rows = q.ok ? await q.json() : [];
    const rec = rows[0];
    if (!rec || new Date(rec.expires_at).getTime() < Date.now() || rec.attempts >= MAX_CODE_ATTEMPTS)
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });

    if (!hashEq(rec.code_hash, sha256(code))) {
      // Sumar intento (best-effort). A los 5 el código queda muerto.
      fetch(`${SB_URL}/rest/v1/owner_login_codes?id=eq.${encodeURIComponent(rec.id)}`, {
        method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ attempts: (rec.attempts || 0) + 1 }),
      }).catch(() => {});
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });
    }

    // Consumir el código (un solo uso).
    await fetch(`${SB_URL}/rest/v1/owner_login_codes?id=eq.${encodeURIComponent(rec.id)}`, {
      method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ consumed: true }),
    });

    // Emitir sesión de 30 días. Guardamos solo el hash del token.
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    const sIns = await fetch(`${SB_URL}/rest/v1/owner_sessions`, {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ token_hash: sha256(token), email, expires_at: expiresAt }),
    });
    if (!sIns.ok) {
      console.error('[owner] session insert error:', await sIns.text());
      return res.status(500).json({ error: 'No pudimos iniciar la sesión. Probá de nuevo.' });
    }
    return res.status(200).json({ ok: true, token, expiresAt });
  }

  // ── De acá para abajo: requiere sesión válida ─────────────────────────
  if (!(await sessionOk(req))) return res.status(401).json({ error: 'Sesión vencida. Volvé a entrar.' });

  if (action === 'list') {
    const r = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?select=*&order=created_at.desc`,
      { headers: svcHeaders() }
    );
    if (!r.ok) {
      console.error('[owner] list error:', await r.text());
      return res.status(500).json({ error: 'No pudimos leer los prospectos.' });
    }
    const leads = await r.json();
    return res.status(200).json({ ok: true, leads });
  }

  if (action === 'source') {
    // Sourcing pega a Google (con costo) — lo limitamos fuerte.
    if (!(await checkRateLimit('owner-source:' + ip, 60, 5, { failClosed: true })))
      return res.status(429).json({ error: 'Esperá un momento antes de buscar de nuevo.' });

    const { added, found, error } = await sourceDistributors(req.body?.query);
    if (error) {
      const msg = error === 'places_not_configured'
        ? 'La búsqueda de distribuidoras no está configurada todavía.'
        : 'No pudimos completar la búsqueda. Probá de nuevo.';
      return res.status(error === 'places_not_configured' ? 503 : 502).json({ error: msg });
    }
    return res.status(200).json({ ok: true, added, found });
  }

  if (action === 'enrich') {
    if (!(await checkRateLimit('owner-enrich:' + ip, 60, 10, { failClosed: true })))
      return res.status(429).json({ error: 'Esperá un momento antes de enriquecer otro prospecto.' });

    const id = clean(req.body?.id, 60);
    if (!id) return res.status(400).json({ error: 'Falta el id del prospecto' });

    const q = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      { headers: svcHeaders() }
    );
    const lead = q.ok ? (await q.json())[0] : null;
    if (!lead) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const { enriquecimiento, error } = await enrichLead(lead);
    if (error) {
      const msg = error === 'anthropic_not_configured'
        ? 'El análisis con IA no está configurado.'
        : 'No pudimos analizar este prospecto. Probá de nuevo.';
      return res.status(error === 'anthropic_not_configured' ? 503 : 502).json({ error: msg });
    }

    const patch = { enriquecimiento, enriquecido_at: new Date().toISOString() };
    const upd = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?id=eq.${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) }
    );
    if (!upd.ok) console.warn('[owner] enrich save error:', await upd.text()); // no bloquea: igual devolvemos
    return res.status(200).json({ ok: true, enriquecimiento, enriquecido_at: patch.enriquecido_at });
  }

  if (action === 'update') {
    const id = clean(req.body?.id, 60);
    if (!id) return res.status(400).json({ error: 'Falta el id del prospecto' });

    const patch = { updated_at: new Date().toISOString() };
    if (req.body?.estado != null) {
      const estado = clean(req.body.estado, 20);
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
      patch.estado = estado;
    }
    if (req.body?.notas != null) patch.notas = clean(req.body.notas, 2000) || null;

    // Seguimiento: "Ya le escribí" registra el contacto y agenda el próximo toque.
    if (req.body?.marcar_contacto === true) {
      const now = Date.now();
      patch.ultimo_contacto_at = new Date(now).toISOString();
      patch.seguir_desde = new Date(now + FOLLOW_UP_DAYS * 86400000).toISOString();
      // Si estaba "nuevo", el primer contacto lo pasa a "contactado".
      if (!patch.estado) patch.estado = 'contactado';
    }
    // "Posponer": corre el próximo toque sin tocar el último contacto real.
    if (req.body?.posponer != null) {
      const dias = Math.min(Math.max(parseInt(req.body.posponer, 10) || FOLLOW_UP_DAYS, 1), 60);
      patch.seguir_desde = new Date(Date.now() + dias * 86400000).toISOString();
    }

    const upd = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?id=eq.${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) }
    );
    if (!upd.ok) {
      console.error('[owner] update error:', await upd.text());
      return res.status(500).json({ error: 'No pudimos guardar el cambio.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}

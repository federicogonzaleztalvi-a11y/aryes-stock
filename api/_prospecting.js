// api/_prospecting.js — Motor de sourcing + enriquecimiento REUSABLE.
// ----------------------------------------------------------------------------
// Piezas genéricas para "buscar comercios reales y entender su negocio":
//   • placesSearch  → busca en Google Places (New) y devuelve los lugares.
//   • readWeb       → lee la web o el perfil de IG/FB del comercio (Apify).
//   • anthropicJSON → le pide a Claude un objeto JSON (enriquecimiento).
//
// Es AGNÓSTICO de org y de tabla: no sabe de multi-tenant, no inserta en ningún
// lado. Quien lo llama (api/lead.js, por-org) decide el prompt, el destino y el
// filtro de aislamiento. Así el mismo motor sirve para que cada distribuidor
// cliente de Pazque busque SUS compradores, cada uno viendo solo lo suyo.
//
// /owner tiene su propia copia de este motor (afinada para pazque_leads) y NO
// depende de este archivo: son embudos distintos que no se cruzan.

const ANTHROPIC_KEY     = process.env.ANTHROPIC_KEY;
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const APIFY_TOKEN       = process.env.APIFY_TOKEN;   // opcional: lee IG/FB pasando el muro de login

export const placesConfigured    = () => !!GOOGLE_PLACES_KEY;
export const anthropicConfigured = () => !!ANTHROPIC_KEY;

export function clean(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// ── Lectura de web / redes ──────────────────────────────────────────────────

// Extrae el content de un <meta property="X"> o <meta name="X"> (cualquier orden).
function metaContent(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + k + '["\']', 'i');
  return (html.match(re1) || html.match(re2) || [])[1] || '';
}

// Texto visible del sitio del comercio. IG/FB tienen muro de login: nos quedamos
// solo con las etiquetas og: (título/descripción). Best-effort: timeout corto.
async function fetchSiteText(url) {
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
    if (!r.ok) return '';
    if (!/text\/html|text\/plain/i.test(r.headers.get('content-type') || '')) return '';
    let html = (await r.text()).slice(0, 200000);
    const head = [metaContent(html, 'og:title'), metaContent(html, 'og:description'), metaContent(html, 'description')]
      .filter(Boolean).join(' · ');
    if (social) return head.slice(0, 1200);
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    return (head + ' ' + html).replace(/\s+/g, ' ').trim().slice(0, 3500);
  } catch { return ''; }
}

// Corre un actor de Apify de forma síncrona (un item). Si no hay token / falla /
// tarda, devuelve []. Los scrapers de Apify SÍ entran a IG/FB pasando el login.
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
    if (!r.ok) { console.warn('[prospecting] apify error:', actorId, r.status); return []; }
    const items = await r.json();
    return Array.isArray(items) ? items : [];
  } catch (e) { clearTimeout(t); console.warn('[prospecting] apify fail:', actorId, e.message); return []; }
}

// Perfil real de IG/FB del comercio (bio, seguidores, últimos posts). '' si no
// hay token, no es red o el actor no devuelve nada.
async function scrapeSocial(url) {
  if (!APIFY_TOKEN || !url) return '';
  let host = '';
  try { host = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); }
  catch { return ''; }

  if (/(^|\.)instagram\.com$/i.test(host)) {
    const user = (String(url).match(/instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1];
    const skip = ['p', 'reel', 'reels', 'explore', 'stories', 'tv'];
    if (!user || skip.includes(user.toLowerCase())) return '';
    const p = (await apifyRun('apify~instagram-profile-scraper', { usernames: [user] }))[0];
    if (!p) return '';
    const posts = Array.isArray(p.latestPosts)
      ? p.latestPosts.slice(0, 6).map(x => x?.caption).filter(Boolean).join(' | ') : '';
    return [
      p.fullName && `Nombre: ${p.fullName}`,
      p.biography && `Bio: ${p.biography}`,
      p.followersCount != null && `Seguidores: ${p.followersCount}`,
      p.postsCount != null && `Posts: ${p.postsCount}`,
      p.businessCategoryName && `Categoría: ${p.businessCategoryName}`,
      posts && `Últimos posts: ${posts}`,
    ].filter(Boolean).join(' · ').slice(0, 2500);
  }

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

  return '';
}

// Lee lo mejor que haya del comercio: primero IG/FB a fondo (Apify), si no cae
// en el texto del sitio. '' si no hay URL o no se pudo leer nada.
export async function readWeb(url) {
  if (!url) return '';
  let web = await scrapeSocial(url);
  if (!web) web = await fetchSiteText(url);
  return web;
}

// ── Google Places (New) ─────────────────────────────────────────────────────
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

// Busca comercios reales. Trae hasta `maxPages` páginas (Google pagina de a 20).
// `fields` = X-Goog-FieldMask (define el costo del SKU). [] si no hay key.
export async function placesSearch(query, { fields, regionCode = 'UY', languageCode = 'es', maxPages = 2 } = {}) {
  if (!GOOGLE_PLACES_KEY) return [];
  const results = [];
  let pageToken = null;
  for (let page = 0; page < maxPages; page++) {
    const body = { textQuery: query, regionCode, languageCode };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': fields,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.warn('[prospecting] places error:', r.status, await r.text().catch(() => '')); break; }
    const d = await r.json();
    for (const p of (d.places || [])) results.push(p);
    pageToken = d.nextPageToken || null;
    if (!pageToken) break;
    await new Promise(res => setTimeout(res, 1600)); // Google exige pausa antes del nextPageToken
  }
  return results;
}

// ── Claude → objeto JSON ────────────────────────────────────────────────────
// Le pide a Claude un JSON con `system`+`user`. Devuelve el objeto parseado o
// null (no configurado / error / parse falló). Quien llama normaliza los campos.
export async function anthropicJSON({ system, user, model = 'claude-sonnet-4-6', maxTokens = 600 }) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) { console.warn('[prospecting] anthropic error:', r.status); return null; }
    const d = await r.json();
    let text = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
    return JSON.parse(text);
  } catch (e) { console.warn('[prospecting] anthropic parse error:', e.message); return null; }
}

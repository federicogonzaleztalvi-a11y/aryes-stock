// Edge Middleware — inyecta meta tags por-org en el HTML que ven los robots.
//
// Problema: WhatsApp / Facebook / Google leen el HTML ESTÁTICO (index.html) y NO
// ejecutan JavaScript. Por eso el <title>Pazque</title> estático se filtraba en el
// preview de los links del portal de un cliente (ej. pedidos.aryes.com.uy mostraba
// "Pazque" aunque el logo ya era el de Aryes).
//
// Solución: solo para dominios CUSTOM (no los de Pazque), resolvemos el org por el
// Host (domain_orgs), cargamos su branding (app_config brandcfg) y reescribimos en
// el HTML el <title>, el apple-mobile-web-app-title y las og:* tags con el nombre y
// logo de ESA distribuidora. Genérico por-org, sin hardcodear ninguna empresa.
//
// Fail-safe: ante cualquier duda o error, dejamos pasar el HTML original sin tocar.

export const config = {
  // Solo las rutas que sirven el shell HTML del portal.
  matcher: ['/', '/pedidos'],
};

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const FALLBACK_DESC =
  'Sistema de gestión para distribuidoras — inventario, ventas, rutas y portal B2B';

function sanitizeOrg(v) {
  return String(v || '').replace(/[^a-z0-9_-]/gi, '');
}

// Hosts que son "de Pazque" → no tocamos nada (siguen mostrando "Pazque").
function esHostPazque(host) {
  const h = (host || '').split(':')[0].toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.vercel.app') ||
    h.includes('aryes-stock') ||
    h === 'pazque.com' ||
    h === 'www.pazque.com'
  );
}

async function resolveOrgFromHost(host) {
  if (!host || !SB_URL || !SB_KEY) return null;
  const clean = host.split(':')[0].toLowerCase();
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/domain_orgs?domain=eq.${encodeURIComponent(clean)}&active=eq.true&select=org_id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) return sanitizeOrg(data[0].org_id);
  } catch { /* sin red → fallback */ }
  return null;
}

async function loadBranding(org) {
  if (!org || !SB_URL || !SB_KEY) return {};
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/app_config?key=eq.brandcfg&org_id=eq.${encodeURIComponent(org)}&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) return {};
    const data = await r.json();
    return data?.[0]?.value || {};
  } catch { return {}; }
}

// Escapa para meter texto dentro de un atributo HTML ("...") de forma segura.
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.host;

    // Dominios de Pazque → dejamos el HTML tal cual (preview "Pazque" es correcto).
    if (esHostPazque(host)) return undefined;

    const org = await resolveOrgFromHost(host);
    if (!org) return undefined; // dominio no mapeado → no tocamos nada

    const brand = await loadBranding(org);
    const name = (brand.name && String(brand.name).trim()) || '';
    if (!name) return undefined; // sin nombre propio → dejamos el original

    const logo = (brand.logoUrl && String(brand.logoUrl).trim()) || '';
    const pageUrl = `${url.origin}${url.pathname}`;

    // Traemos el HTML estático original. /index.html no está en el matcher, así que
    // este fetch no vuelve a entrar al middleware (sin loops).
    const originRes = await fetch(new URL('/index.html', url.origin));
    if (!originRes.ok) return undefined;
    let html = await originRes.text();

    const nameAttr = escapeAttr(name);
    const descAttr = escapeAttr(FALLBACK_DESC);
    const urlAttr = escapeAttr(pageUrl);
    const logoAttr = logo ? escapeAttr(logo) : '';

    // 1) <title>…</title> → nombre del cliente
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${nameAttr}</title>`);

    // 2) apple-mobile-web-app-title → nombre del cliente
    html = html.replace(
      /(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/i,
      `$1${nameAttr}$2`
    );

    // 3) og:* / twitter para el preview de WhatsApp, Facebook, etc.
    const ogTags = [
      `<meta property="og:title" content="${nameAttr}">`,
      `<meta property="og:description" content="${descAttr}">`,
      `<meta property="og:url" content="${urlAttr}">`,
      `<meta property="og:type" content="website">`,
      logoAttr ? `<meta property="og:image" content="${logoAttr}">` : '',
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${nameAttr}">`,
      `<meta name="twitter:description" content="${descAttr}">`,
      logoAttr ? `<meta name="twitter:image" content="${logoAttr}">` : '',
    ].filter(Boolean).join('\n    ');

    html = html.replace(/<\/head>/i, `    ${ogTags}\n  </head>`);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Corto: el branding cambia poco, pero un cambio debe verse pronto.
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    // Cualquier error → dejamos pasar el HTML original sin tocar.
    return undefined;
  }
}

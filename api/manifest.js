// Manifest PWA dinámico por-org. La app instalada en el cel del cliente toma el
// nombre y el logo de SU distribuidora (ej. "Aryes" en pedidos.aryes.com.uy),
// no "Pazque". Es genérico: cada cliente nuevo es solo una fila en domain_orgs +
// su branding en app_config (key=brandcfg). Sin hardcodear ninguna org.
//
// El org se resuelve, en orden:
//   1. ?org= explícito (útil para probar / pazque.com/pedidos?org=...)
//   2. el Host del request (dominio custom → domain_orgs)
//   3. fallback genérico "Pazque"

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const FALLBACK = {
  name: 'Pazque',
  short_name: 'Pazque',
  description: 'Sistema de gestión para distribuidoras — inventario, ventas, rutas y portal B2B',
  theme_color: '#059669',
  icon: '/pazque-logo.png',
};

function sanitizeOrg(v) {
  return String(v || '').replace(/[^a-z0-9_-]/gi, '');
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
  } catch { /* sin red / sin fila → fallback */ }
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

export default async function handler(req, res) {
  let org = sanitizeOrg(req.query?.org);
  if (!org) org = await resolveOrgFromHost(req.headers?.host);

  const brand = org ? await loadBranding(org) : {};
  const name  = (brand.name && String(brand.name).trim()) || FALLBACK.name;
  const theme = (brand.themeColor && String(brand.themeColor).trim()) || FALLBACK.theme_color;
  const icon  = (brand.logoUrl && String(brand.logoUrl).trim()) || FALLBACK.icon;

  // Variante "vendedor": el portal del vendedor (/vendedor) se instala como una
  // app PROPIA, distinta de la del cliente. Distinto id + start_url para que el
  // sistema la trate como otra app y el ícono abra el login del vendedor.
  const isVendedor = String(req.query?.app || '') === 'vendedor';

  // short_name: máximo ~12 chars para que entre bajo el ícono en el homescreen.
  const shortName = isVendedor ? 'Vendedores' : (name.length > 12 ? name.slice(0, 12) : name);

  const manifest = {
    id: isVendedor ? '/vendedor' : '/pedidos',
    name: isVendedor ? `${name} · Vendedores` : name,
    short_name: shortName,
    description: FALLBACK.description,
    start_url: isVendedor ? '/vendedor' : '/pedidos',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: theme,
    orientation: 'any',
    categories: ['business', 'productivity'],
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  // Cache corto: el branding cambia poco, pero queremos que un cambio se vea sin esperar horas.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return res.status(200).send(JSON.stringify(manifest));
}

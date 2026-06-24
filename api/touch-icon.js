// Ícono de "Agregar a inicio" (iOS) dinámico por-org. iOS toma el ícono del
// <link rel="apple-touch-icon">, que era fijo /pazque-logo.png → todos los
// clientes veían el logo de Pazque. Acá resolvemos el org por el dominio
// (domain_orgs) y servimos SU logo. Genérico: sin hardcodear ninguna org.
// Funciona incluso antes del login (resuelve por Host, no por sesión).

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
  } catch { /* fallback */ }
  return null;
}

async function loadLogoUrl(org) {
  if (!org || !SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/app_config?key=eq.brandcfg&org_id=eq.${encodeURIComponent(org)}&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const url = data?.[0]?.value?.logoUrl;
    return url && String(url).trim() ? String(url).trim() : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  let org = sanitizeOrg(req.query?.org);
  if (!org) org = await resolveOrgFromHost(req.headers?.host);
  const logoUrl = org ? await loadLogoUrl(org) : null;

  // Sin logo propio → ícono genérico de Pazque (asset estático).
  if (!logoUrl) {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.writeHead(302, { Location: '/pazque-logo.png' });
    return res.end();
  }

  // Servimos los bytes del logo (más confiable que un redirect para íconos).
  try {
    const imgRes = await fetch(logoUrl);
    if (!imgRes.ok) throw new Error('logo fetch ' + imgRes.status);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(buf);
  } catch {
    res.writeHead(302, { Location: '/pazque-logo.png' });
    return res.end();
  }
}

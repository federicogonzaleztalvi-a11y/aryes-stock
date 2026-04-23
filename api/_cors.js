// api/_cors.js — Dynamic CORS for multi-tenant custom domains
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BASE_ORIGIN = process.env.APP_URL || 'https://pazque.com';

// Cache domain list for 5 minutes to avoid DB hit on every request
let _domainCache = null;
let _domainCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getAllowedOrigins() {
  const now = Date.now();
  if (_domainCache && now - _domainCacheTime < CACHE_TTL) return _domainCache;

  const origins = [BASE_ORIGIN, 'https://pazque.com'];

  if (SB_URL && SB_KEY) {
    try {
      const r = await fetch(
        SB_URL + '/rest/v1/domain_orgs?active=eq.true&select=domain',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Accept: 'application/json' } }
      );
      if (r.ok) {
        const rows = await r.json();
        for (const row of rows) {
          if (row.domain) {
            origins.push('https://' + row.domain);
            origins.push('https://www.' + row.domain);
          }
        }
      }
    } catch (e) {
      console.error('[_cors] Error fetching domains:', e.message);
    }
  }

  _domainCache = origins;
  _domainCacheTime = now;
  return origins;
}

export async function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = await getAllowedOrigins();

  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', BASE_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export { BASE_ORIGIN };

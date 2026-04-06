#!/usr/bin/env node
// patch-cors-whatsapp.cjs — Dynamic CORS for custom domains + WhatsApp sender per org

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 1. Create shared CORS helper: api/_cors.js
// ═══════════════════════════════════════════════════════════════

const corsHelper = `// api/_cors.js — Dynamic CORS for multi-tenant custom domains
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BASE_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';

// Cache domain list for 5 minutes to avoid DB hit on every request
let _domainCache = null;
let _domainCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getAllowedOrigins() {
  const now = Date.now();
  if (_domainCache && now - _domainCacheTime < CACHE_TTL) return _domainCache;

  const origins = [BASE_ORIGIN, 'https://aryes-stock.vercel.app'];

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
`;

const corsPath = path.join(process.cwd(), 'api/_cors.js');
if (!fs.existsSync(corsPath)) {
  fs.writeFileSync(corsPath, corsHelper, 'utf8');
  console.log('✅ Created api/_cors.js (dynamic CORS helper)');
} else {
  console.log('⏭  api/_cors.js already exists');
}

// ═══════════════════════════════════════════════════════════════
// 2. WhatsApp multi-tenant: add whatsapp_sender to organizations
//    and use it in otp-send.js
// ═══════════════════════════════════════════════════════════════

const otpPath = path.join(process.cwd(), 'api/otp-send.js');
let otp = fs.readFileSync(otpPath, 'utf8');

if (!otp.includes('org_sender')) {
  // Add org-specific sender lookup after client lookup
  const oldClientCheck = "if (!clients?.length) {\n    return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });\n  }";
  
  const newClientCheck = `if (!clients?.length) {
    return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });
  }

  // Multi-tenant: get org-specific WhatsApp sender if configured
  let org_sender = IB_SENDER;
  try {
    const orgRes = await fetch(
      \`\${SB_URL}/rest/v1/organizations?id=eq.\${encodeURIComponent(org)}&select=whatsapp_sender&limit=1\`,
      { headers: { apikey: key, Authorization: \`Bearer \${key}\`, Accept: 'application/json' } }
    );
    const orgs = await orgRes.json();
    if (orgs?.[0]?.whatsapp_sender) org_sender = orgs[0].whatsapp_sender;
  } catch(e) { console.warn('[otp-send] Could not fetch org sender:', e.message); }`;

  if (otp.includes(oldClientCheck)) {
    otp = otp.replace(oldClientCheck, newClientCheck);
    console.log('✅ otp-send.js: added org-specific sender lookup');
  } else {
    console.log('⚠️  otp-send.js: could not find client check pattern, trying alt');
    // Try simpler pattern
    otp = otp.replace(
      "return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });\n  }",
      "return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });\n  }\n\n  // Multi-tenant: get org-specific WhatsApp sender if configured\n  let org_sender = IB_SENDER;\n  try {\n    const orgRes = await fetch(\n      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=whatsapp_sender&limit=1`,\n      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }\n    );\n    const orgs = await orgRes.json();\n    if (orgs?.[0]?.whatsapp_sender) org_sender = orgs[0].whatsapp_sender;\n  } catch(e) { console.warn('[otp-send] Could not fetch org sender:', e.message); }"
    );
    console.log('✅ otp-send.js: added org sender lookup (alt pattern)');
  }

  // Replace IB_SENDER with org_sender in sendViaInfobip calls
  otp = otp.replace(
    'from: IB_SENDER,\n      to,',
    'from: org_sender || IB_SENDER,\n      to,'
  );
  otp = otp.replace(
    "from: IB_SENDER || 'Aryes',",
    "from: org_sender || IB_SENDER || 'Aryes',"
  );
  console.log('✅ otp-send.js: using org_sender for WhatsApp/SMS');
} else {
  console.log('⏭  otp-send.js: multi-tenant sender already configured');
}

fs.writeFileSync(otpPath, otp, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ CORS + WhatsApp multi-tenant patched!

  api/_cors.js → Dynamic CORS from domain_orgs table
    - Caches allowed domains for 5 min
    - Checks request origin against DB
    - Falls back to BASE_ORIGIN

  otp-send.js → Org-specific WhatsApp sender
    - Looks up organizations.whatsapp_sender
    - Falls back to INFOBIP_SENDER env var
    - Each org can have its own WhatsApp number

  NEXT STEPS:
  1. Add whatsapp_sender column to organizations table:
     ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_sender text;
  2. When a client has their own WhatsApp Business:
     UPDATE organizations SET whatsapp_sender = '598XXXXXXXXX' WHERE id = 'org_id';
  3. To enable a custom domain for a client:
     INSERT INTO domain_orgs (org_id, domain, active) VALUES ('org_id', 'stock.client.com', true);
══════════════════════════════════════════════`);

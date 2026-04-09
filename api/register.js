// api/register.js — Public self-registration endpoint
// Creates a new organization + admin user in one atomic operation.
// No auth required — this is the public signup flow.

import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';


const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin': process.env.APP_URL || 'https://aryes-stock.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Generate a clean org_id from company name
// "Distribuidora García" -> "distribuidora-garcia"
function toOrgId(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}


import { checkRateLimit } from './_rate-limit.js';

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  // Rate limit check
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
  if (!(await checkRateLimit('register:' + clientIp, 3600, 3))) {
    log.warn('register', 'rate limited', { ip: clientIp });
    return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' });
  }
  if (!SB_URL || !SB_SVC)     return res.status(500).json({ error: 'Server misconfigured' });

  const { empresa, email, password, nombre } = req.body || {};

  // Validate inputs
  if (!empresa?.trim())  return res.status(400).json({ error: 'Nombre de empresa requerido' });
  if (!email?.trim())    return res.status(400).json({ error: 'Email requerido' });
  if (!password)         return res.status(400).json({ error: 'Contraseña requerida' });
  if (!nombre?.trim())   return res.status(400).json({ error: 'Tu nombre es requerido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });

  const headers = {
    apikey:          SB_SVC,
    Authorization:  `Bearer ${SB_SVC}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // Generate org_id — make it unique if needed
  let orgId = toOrgId(empresa.trim());
  if (!orgId) orgId = 'org-' + Date.now();

  // Check if org_id already exists, append number if needed
  const orgCheck = await fetch(
    `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(orgId)}&limit=1`,
    { headers }
  );
  if (orgCheck.ok) {
    const existing = await orgCheck.json();
    if (existing?.length > 0) {
      orgId = orgId + '-' + Date.now().toString().slice(-4);
    }
  }

  // ── Step 1: Create Supabase Auth user ────────────────────────────
  const authRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      email:             email.trim().toLowerCase(),
      password,
      email_confirm:     true,  // skip email confirmation for now
      user_metadata:     { nombre: nombre.trim(), org_id: orgId, role: 'admin' },
    }),
  });

  if (!authRes.ok) {
    const err = await authRes.json().catch(() => ({}));
    const msg = err?.message || err?.msg || '';
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      return res.status(400).json({ error: 'Ya existe una cuenta con ese email. Iniciá sesión.' });
    }
    log.error('register', 'auth user creation failed', { msg });
    return res.status(400).json({ error: 'Error al crear la cuenta. Intentá de nuevo.' });
  }

  const authData = await authRes.json();
  const userId = authData.id;

  // ── Step 2: Create organization record ───────────────────────────
  const orgRes = await fetch(`${SB_URL}/rest/v1/organizations`, {
    method:  'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      id:                  orgId,
      name:                empresa.trim(),
      email:               email.trim().toLowerCase(),
      plan:                'trial',
      plan_name:           'trial',
      subscription_status: 'trial',
      trial_ends_at:       new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      active:              true,
    }),
  });

  if (!orgRes.ok) {
    // Rollback: delete the auth user
    await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers }).catch(() => {});
    log.error('register', 'org creation failed', { orgId });
    return res.status(500).json({ error: 'Error al crear la organización. Intentá de nuevo.' });
  }

  // ── Step 3: Insert into public.users table ────────────────────────
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
  const userRes = await fetch(`${SB_URL}/rest/v1/users`, {
    method:  'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      username,
      name:   nombre.trim(),
      email:  email.trim().toLowerCase(),
      role:   'admin',
      active: true,
      org_id: orgId,
    }),
  });

  if (!userRes.ok) {
    // Non-fatal — auth user and org exist, user table row is secondary
    log.warn('register', 'public.users insert failed (non-fatal)', { orgId, email });
  }

  log.info('register', 'new org registered', { orgId, empresa: empresa.trim(), email });

  return res.status(201).json({
    ok:    true,
    orgId,
    message: 'Cuenta creada exitosamente',
  });
}

export default withObservability('register', handler);

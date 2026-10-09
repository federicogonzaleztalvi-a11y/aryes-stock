// api/register.js — Public self-registration endpoint
// Creates a new organization + admin user in one atomic operation.
// No auth required — this is the public signup flow.

import { log, withObservability } from './_log.js';
import { sendEmail, templates } from './_email.js';
import { setCorsHeaders } from './_cors.js';


const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin': process.env.APP_URL || 'https://pazque.com',
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
  if (!(await checkRateLimit('register:' + clientIp, 3600, 3, { failClosed: true }))) {
    log.warn('register', 'rate limited', { ip: clientIp });
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
  }
  if (!SB_URL || !SB_SVC)     return res.status(500).json({ error: 'Server misconfigured' });

  const { empresa, email, password, nombre, ref } = req.body || {};

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
      return res.status(400).json({ error: 'Ya existe una cuenta con ese email. Inicia sesión.' });
    }
    log.error('register', 'auth user creation failed', { msg });
    return res.status(400).json({ error: 'Error al crear la cuenta. Inténtalo de nuevo.' });
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
    return res.status(500).json({ error: 'Error al crear la organización. Inténtalo de nuevo.' });
  }

  // ── Step 2.5: Initialize app_config with brand defaults ───────────
  // Non-blocking: if it fails, user can still set brand from Config later.
  try {
    await fetch(`${SB_URL}/rest/v1/app_config`, {
      method:  'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        key:        'brandcfg',
        org_id:     orgId,
        value:      { name: empresa.trim(), email: email.trim().toLowerCase(), color: '#059669' },
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    log.warn('register', 'app_config brandcfg init failed (non-fatal)', { orgId, msg: e?.message });
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
    // Non-fatal para el usuario: auth + org existen y el login cae al user_metadata
    // del JWT (org_id + role) para entrar bien igual. Pero lo logueamos como ERROR
    // (no warn) para que dispare la alerta de la Torre de Control: si esto falla seguido,
    // hay un problema de RLS/schema que hay que atacar en origen.
    const uerr = await userRes.text().catch(() => '');
    log.error('register', 'public.users insert failed (login usa metadata fallback)', { orgId, email, status: userRes.status, uerr: uerr.slice(0, 300) });
  }

  log.info('register', 'new org registered', { orgId, empresa: empresa.trim(), email });

  // ── Atribución del agente de ventas (best-effort, NUNCA bloquea el registro) ──
  // Si el prospecto llegó desde un link del agente (/register?ref=<id del lead>),
  // conectamos esta prueba con el pazque_lead: así /owner sabe de qué mensaje salió.
  // El ref es el UUID del lead (ni dato personal ni adivinable). Si algo falla,
  // el registro ya está hecho igual — esto es solo medición.
  const refUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(ref || '').trim())
    ? String(ref).trim() : null;
  if (refUuid) {
    try {
      await fetch(`${SB_URL}/rest/v1/pazque_leads?id=eq.${refUuid}`, {
        method:  'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ inicio_prueba_at: new Date().toISOString(), org_convertida: orgId }),
      });
    } catch (e) { log.warn('register', 'lead attribution failed (non-fatal)', { refUuid, error: e?.message }); }
  }

  // Email de bienvenida (non-blocking)
  try {
    const tpl = templates.welcome(empresa.trim());
    await sendEmail({ to: email, ...tpl });
  } catch (e) { log.warn('register', 'welcome email failed', { email, error: e.message }); }

  return res.status(201).json({
    ok:    true,
    orgId,
    message: 'Cuenta creada exitosamente',
  });
}

export default withObservability('register', handler);

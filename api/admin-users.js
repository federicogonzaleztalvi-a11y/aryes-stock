// Vercel Serverless — User Management Proxy
// All Supabase Auth operations use SECURITY DEFINER RPCs (bypasses GoTrue restrictions)
// UPDATE/DELETE on public.users use service_role key (bypasses RLS)

import { setCorsHeaders } from './_cors.js';

const SB_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Call a SECURITY DEFINER RPC — bypasses ALL RLS, runs as postgres superuser
async function rpc(fnName, params = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// Verify caller is admin using Supabase getUser (cryptographically verifies JWT signature)
// This replaces the insecure decodeJwtPayload which did NOT verify the signature
async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!SERVICE_KEY) return null;

  // Step 1: Verify JWT signature via Supabase Auth — rejects tampered tokens
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!userRes.ok) return null; // invalid or expired token
  const userData = await userRes.json();
  if (!userData?.id || !userData?.email) return null;

  // Step 2: Verify role in DB via SECURITY DEFINER RPC
  const { ok, data: role } = await rpc('get_user_role_by_email', { user_email: userData.email });
  console.log(`[VA] ${userData.email} role:${role}`);
  if (!ok || role !== 'admin') return null;
  // Extract org_id from user metadata or public.users table
  const orgId = userData.user_metadata?.org_id || null;
  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    // Fallback: look up org_id from public.users table
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(userData.email)}&select=org_id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
    );
    if (orgRes.ok) {
      const orgRows = await orgRes.json();
      resolvedOrgId = orgRows?.[0]?.org_id || 'aryes';
    }
  }
  return { id: userData.id, email: userData.email, orgId: resolvedOrgId || 'aryes' };
}

// Verify the target user (by email) belongs to the admin's org.
// Prevents cross-tenant account takeover: an admin of org A must never be able
// to update / reset-password / delete a user that lives in org B.
async function targetInOrg(email, orgId) {
  const r = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=org_id&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
  );
  if (!r.ok) return false;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return false; // unknown user → deny
  return rows[0].org_id === orgId;
}

export default async function handler(req, res) {
  // Fast-fail: SERVICE_KEY must exist. Missing = server misconfiguration, not auth failure.
  // Log it explicitly so it shows in Vercel function logs, not just as a 500.
  if (!SERVICE_KEY) {
    console.error('[admin-users] SUPABASE_SERVICE_ROLE_KEY is not set — all requests will fail');
  }
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Forbidden: admin only' });

  const { action } = req.query;

  try {

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list') {
      // Filter users by org_id — each org only sees their own users
      const usersRes = await fetch(
        `${SB_URL}/rest/v1/users?org_id=eq.${encodeURIComponent(admin.orgId)}&order=name.asc`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
      );
      const users = usersRes.ok ? await usersRes.json() : [];
      return res.status(200).json(users);
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      const { email, password, name, role } = req.body || {};

      if (!email || !password || !name || !role)
        return res.status(400).json({ error: 'email, password, name y role son requeridos' });
      if (!['admin', 'operador', 'vendedor'].includes(role))
        return res.status(400).json({ error: 'Rol inválido' });
      if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

      // Create the auth user via Supabase Auth Admin API (service_role). This is
      // the officially supported, version-stable path — no fragile RPC nor direct
      // auth.users SQL that breaks across GoTrue versions.
      const authRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password, email_confirm: true,
          user_metadata: { name, org_id: admin.orgId },
          app_metadata: { role, org_id: admin.orgId },
        }),
      });
      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok || !authData?.id) {
        const raw = authData?.msg || authData?.message || authData?.error_description || authData?.error || '';
        if (authRes.status === 422 || /already|registered|exists|duplicate/i.test(raw))
          return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        console.log(`[CREATE] auth admin create failed (${authRes.status}): ${raw}`);
        return res.status(400).json({ error: raw || 'Error al crear el usuario' });
      }
      const newAuthId = authData.id;

      // Insert the matching public.users row with service_role (bypasses RLS).
      // NOTE: public.users.id is an auto-increment integer — do NOT set it. The
      // link to the auth user is by email (that's how login resolves the row).
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const insRes = await fetch(`${SB_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify({ username, name, email, role, org_id: admin.orgId }),
      });

      if (!insRes.ok) {
        // Roll back the auth user so we don't leave an orphan login.
        await fetch(`${SB_URL}/auth/v1/admin/users/${newAuthId}`, {
          method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        const dbErr = await insRes.text().catch(() => '');
        console.log(`[CREATE] public.users insert failed (${insRes.status}): ${dbErr}`);
        return res.status(400).json({ error: 'Error al guardar el usuario. Se revirtió la creación.' });
      }
      const dbRows = await insRes.json().catch(() => null);
      return res.status(201).json({ success: true, user: Array.isArray(dbRows) ? dbRows[0] : dbRows });
    }

    // ── Revoke portal sessions for a client ───────────────────────────────────
    if (action === 'revoke-sessions') {
      const { cliente_id } = req.body || {};
      if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' });

      // Scope the client to the admin's org — no revoking sessions of other tenants' clients
      const cliRes = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${encodeURIComponent(cliente_id)}&select=org_id&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
      );
      const cliRows = cliRes.ok ? await cliRes.json() : [];
      if (!Array.isArray(cliRows) || cliRows.length === 0 || cliRows[0].org_id !== admin.orgId)
        return res.status(403).json({ error: 'Forbidden: cliente de otra organización' });

      const revokeRes = await fetch(
        `${SB_URL}/rest/v1/portal_sessions?cliente_id=eq.${encodeURIComponent(cliente_id)}&revoked=eq.false`,
        {
          method: 'PATCH',
          headers: {
            apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal',
          },
          body: JSON.stringify({ revoked: true }),
        }
      );
      if (!revokeRes.ok) {
        return res.status(500).json({ error: 'Error al revocar sesiones' });
      }
      return res.status(200).json({ ok: true, message: 'Sesiones del cliente revocadas' });
    }

    // ── UPDATE role / active / name ───────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update') {
      const { email, role, active, name } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email requerido' });
      if (email === admin.email && active === false)
        return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });
      if (email === admin.email && role && role !== 'admin')
        return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
      if (!(await targetInOrg(email, admin.orgId)))
        return res.status(403).json({ error: 'Forbidden: usuario de otra organización' });

      const updates = {};
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = active;
      if (name !== undefined) updates.name = name;

      const { ok: upOk, data: upData } = await rpc('update_user_row', {
        p_email: email,
        p_updates: updates,
      });
      if (!upOk) return res.status(400).json({ error: typeof upData === 'string' ? upData : 'Error al actualizar usuario' });
      return res.status(200).json({ success: true, user: Array.isArray(upData) ? upData[0] : upData });
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'reset-password') {
      const { email, newPassword } = req.body || {};
      if (!email || !newPassword)
        return res.status(400).json({ error: 'email y newPassword requeridos' });
      if (newPassword.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      if (!(await targetInOrg(email, admin.orgId)))
        return res.status(403).json({ error: 'Forbidden: usuario de otra organización' });

      const { ok, data } = await rpc('update_auth_password', {
        user_email: email, new_password: newPassword,
      });
      if (!ok) return res.status(400).json({ error: typeof data === 'string' ? data : 'Error al resetear contraseña' });
      if (data === false) return res.status(404).json({ error: 'Usuario no encontrado' });
      return res.status(200).json({ success: true });
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email requerido' });
      if (email === admin.email) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
      if (!(await targetInOrg(email, admin.orgId)))
        return res.status(403).json({ error: 'Forbidden: usuario de otra organización' });

      // Delete from public.users via SECURITY DEFINER RPC (bypasses RLS + cache)
      await rpc('delete_user_row', { p_email: email });

      // Delete from auth via SECURITY DEFINER RPC
      await rpc('delete_auth_user', { user_email: email });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch(e) {
    console.error('[admin-users] action:', action, 'error:', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

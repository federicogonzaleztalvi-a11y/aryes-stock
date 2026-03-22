// Vercel Serverless — User Management Proxy
// All Supabase Auth operations use SECURITY DEFINER RPCs (bypasses GoTrue restrictions)
// UPDATE/DELETE on public.users use service_role key (bypasses RLS)

const SB_URL = process.env.SUPABASE_URL || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch(e) { return null; }
}

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
  try { data = JSON.parse(text); } catch(e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload?.email) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!SERVICE_KEY) return null;
  const { ok, data: role } = await rpc('get_user_role_by_email', { user_email: payload.email });
  console.log(`[VA] ${payload.email} role:${role}`);
  if (!ok || role !== 'admin') return null;
  return { id: payload.sub, email: payload.email };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Forbidden: admin only' });

  const { action } = req.query;

  try {

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list') {
      const { ok, data } = await rpc('list_all_users');
      return res.status(200).json(ok && Array.isArray(data) ? data : []);
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

      // Create auth user via SECURITY DEFINER RPC (avoids GoTrue "User not allowed" error)
      const { ok: authOk, data: authData } = await rpc('create_auth_user', {
        user_email: email, user_password: password, user_name: name, user_role: role,
      });

      if (!authOk) {
        const raw = typeof authData === 'string' ? authData
          : (authData?.message || authData?.msg || authData?.error || JSON.stringify(authData));
        console.log(`[CREATE] auth rpc failed: ${raw}`);
        if (raw.includes('duplicate') || raw.includes('already exists') || raw.includes('unique'))
          return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        return res.status(400).json({ error: raw || 'Error al crear usuario' });
      }

      // Insert into public.users
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const dbRes = await fetch(`${SB_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'return=representation',
        },
        body: JSON.stringify({ username, name, email, role, active: true }),
      });
      const dbData = await dbRes.json().catch(() => ({}));

      if (!dbRes.ok) {
        await rpc('delete_auth_user', { user_email: email }); // rollback
        return res.status(400).json({ error: dbData?.message || 'Error al guardar en DB. Auth revertido.' });
      }

      return res.status(201).json({ success: true, user: Array.isArray(dbData) ? dbData[0] : dbData });
    }

    // ── UPDATE role / active / name ───────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update') {
      const { email, role, active, name } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email requerido' });
      if (email === admin.email && active === false)
        return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });
      if (email === admin.email && role && role !== 'admin')
        return res.status(400).json({ error: 'No podés cambiar tu propio rol' });

      const updates = {};
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = active;
      if (name !== undefined) updates.name = name;

      const r = await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'return=representation',
        },
        body: JSON.stringify(updates),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(400).json({ error: data?.message || 'Error al actualizar usuario' });
      return res.status(200).json({ success: true, user: Array.isArray(data) ? data[0] : data });
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'reset-password') {
      const { email, newPassword } = req.body || {};
      if (!email || !newPassword)
        return res.status(400).json({ error: 'email y newPassword requeridos' });
      if (newPassword.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

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

      // Delete from public.users (service_role bypasses RLS)
      await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });

      // Delete from auth via SECURITY DEFINER RPC
      await rpc('delete_auth_user', { user_email: email });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch(e) {
    console.error('[admin-users] action:', action, 'error:', e.message);
    return res.status(500).json({ error: 'Error interno', detail: e.message });
  }
}

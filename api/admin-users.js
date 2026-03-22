// Vercel Serverless Function — Supabase Auth Admin Proxy
// SERVICE_ROLE_KEY stays server-side only. Never sent to client.

const SB_URL = process.env.SUPABASE_URL || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch(e) { return null; }
}

// Query Supabase bypassing RLS using service_role
async function sbQuery(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = text; }
  return { ok: res.status >= 200 && res.status < 300, status: res.status, data };
}

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload?.email) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!SERVICE_KEY) return null;

  // Call SECURITY DEFINER RPC — runs as postgres, bypasses RLS entirely
  // Verifies role from the users table without trusting the JWT claims
  const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/get_user_role_by_email`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_email: payload.email })
  });
  const role = rpcRes.ok ? await rpcRes.json() : null;
  console.log(`[VA] ${payload.email} rpc_status:${rpcRes.status} role:${role}`);
  if (role !== 'admin') return null;
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
    // ── LIST ────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list') {
      const { ok, data } = await sbQuery('users?select=id,username,name,email,role,active&order=id.asc');
      return res.status(200).json(ok && Array.isArray(data) ? data : []);
    }

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      const { email, password, name, role } = req.body || {};
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'email, password, name y role son requeridos' });
      }
      if (!['admin','operador','vendedor'].includes(role)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      // Create in Supabase Auth
      const authRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const authData = await authRes.json();
      if (!authRes.ok) return res.status(400).json({ error: authData.message || 'Error al crear usuario en Auth' });

      // Insert into users table
      const dbRes = await fetch(`${SB_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ username: email.split('@')[0], name, email, role, active: true })
      });
      const dbData = await dbRes.json();
      if (!dbRes.ok) {
        // Rollback
        await fetch(`${SB_URL}/auth/v1/admin/users/${authData.id}`, {
          method: 'DELETE', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        return res.status(400).json({ error: 'Error al crear usuario en DB. Revertido.' });
      }
      return res.status(201).json({ success: true, user: Array.isArray(dbData) ? dbData[0] : dbData });
    }

    // ── UPDATE role/active/name ─────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update') {
      const { email, role, active, name } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email requerido' });
      const updates = {};
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = active;
      if (name !== undefined) updates.name = name;
      const r = await fetch(`${SB_URL}/rest/v1/users?email=eq.${email}`, {
        method: 'PATCH',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(updates)
      });
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: 'Error al actualizar usuario' });
      return res.status(200).json({ success: true, user: Array.isArray(data) ? data[0] : data });
    }

    // ── RESET PASSWORD ──────────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'reset-password') {
      const { email, newPassword } = req.body || {};
      if (!email || !newPassword) return res.status(400).json({ error: 'email y newPassword requeridos' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
      // Find auth user
      const listRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const listData = await listRes.json();
      const authUserId = (listData?.users || []).find(u => u.email === email)?.id;
      if (!authUserId) return res.status(404).json({ error: 'Usuario no encontrado en Auth' });
      const r = await fetch(`${SB_URL}/auth/v1/admin/users/${authUserId}`, {
        method: 'PUT',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (!r.ok) { const e = await r.json(); return res.status(400).json({ error: e.message || 'Error al resetear' }); }
      return res.status(200).json({ success: true });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email requerido' });
      if (email === admin.email) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
      // Find auth user
      const listRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const listData = await listRes.json();
      const authUserId = (listData?.users || []).find(u => u.email === email)?.id;
      // Delete from users table
      await fetch(`${SB_URL}/rest/v1/users?email=eq.${email}`, {
        method: 'DELETE', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      // Delete from Auth
      if (authUserId) {
        await fetch(`${SB_URL}/auth/v1/admin/users/${authUserId}`, {
          method: 'DELETE', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch(e) {
    console.error('[admin-users] action:', action, 'error:', e.message);
    return res.status(500).json({ error: 'Error interno', detail: e.message });
  }
}

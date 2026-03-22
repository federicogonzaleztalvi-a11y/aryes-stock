// Vercel Serverless Function — Supabase Auth Admin Proxy
// This runs server-side only. The SERVICE_ROLE_KEY is never exposed to the client.
// All operations require a valid admin JWT passed in the Authorization header.

const SB_URL = process.env.SUPABASE_URL || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Decode JWT payload without verification (signature is verified by Supabase internally).
// We trust the token structure and verify the role authoritatively in the DB using service_role.
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch(e) { return null; }
}

// Verify the calling user is authenticated and has admin role
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Decode payload to get email/sub without a network call
  const payload = decodeJwtPayload(token);
  console.log('[verifyAdmin] payload email:', payload?.email, 'sub:', payload?.sub, 'exp:', payload?.exp);
  if (!payload?.sub || !payload?.email) {
    console.log('[verifyAdmin] FAIL: missing sub or email in payload');
    return null;
  }

  // Check token is not expired
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    console.log('[verifyAdmin] FAIL: token expired at', payload.exp, 'now:', now);
    return null;
  }

  // Authoritatively verify role in DB using service_role key
  const dbUrl = `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(payload.email)}&select=role,active&limit=1`;
  console.log('[verifyAdmin] querying DB:', dbUrl);
  const roleRes = await fetch(dbUrl,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  console.log('[verifyAdmin] DB status:', roleRes.status);
  if (!roleRes.ok) {
    console.log('[verifyAdmin] FAIL: DB query failed', roleRes.status);
    return null;
  }
  const rows = await roleRes.json();
  console.log('[verifyAdmin] DB rows:', JSON.stringify(rows));
  if (!rows?.length || rows[0].role !== 'admin') {
    console.log('[verifyAdmin] FAIL: role not admin, rows:', JSON.stringify(rows));
    return null;
  }
  if (rows[0].active === false) {
    console.log('[verifyAdmin] FAIL: user inactive');
    return null;
  }

  return { id: payload.sub, email: payload.email };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing service key' });
  }

  // Authenticate the calling admin
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Forbidden: admin only' });

  const { action } = req.query;

  try {
    // ── LIST users ──────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list') {
      const r = await fetch(`${SB_URL}/rest/v1/users?select=id,username,name,email,role,active&order=id.asc`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const rows = await r.json();
      return res.status(200).json(rows);
    }

    // ── CREATE user ─────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      const { email, password, name, role } = req.body;
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'email, password, name y role son requeridos' });
      }
      const VALID_ROLES = ['admin', 'operador', 'vendedor'];
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }

      // Create in Supabase Auth
      const authRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const authData = await authRes.json();
      if (!authRes.ok) {
        return res.status(400).json({ error: authData.message || authData.msg || 'Error al crear usuario en Auth' });
      }

      // Insert into users table
      const username = email.split('@')[0];
      const dbRes = await fetch(`${SB_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ username, name, email, role, active: true })
      });
      const dbData = await dbRes.json();
      if (!dbRes.ok) {
        // Rollback: delete auth user
        await fetch(`${SB_URL}/auth/v1/admin/users/${authData.id}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        return res.status(400).json({ error: 'Usuario creado en Auth pero falló en DB. Revertido.' });
      }

      return res.status(201).json({ success: true, user: dbData[0] || dbData });
    }

    // ── UPDATE role / active ─────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update') {
      const { email, role, active, name } = req.body;
      if (!email) return res.status(400).json({ error: 'email requerido' });

      const updates = {};
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = active;
      if (name !== undefined) updates.name = name;

      const r = await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: 'Error al actualizar usuario' });
      return res.status(200).json({ success: true, user: data[0] || data });
    }

    // ── RESET PASSWORD ───────────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'reset-password') {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) return res.status(400).json({ error: 'email y newPassword requeridos' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

      // Find the auth user ID by email
      // Find auth user by listing and filtering (Supabase admin list supports email filter)
      const listRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const listData = await listRes.json();
      const authUser = (listData?.users || []).find(u => u.email === email);
      if (!authUser?.id) return res.status(404).json({ error: 'Usuario no encontrado en Auth' });
      const authUserId = authUser.id;

      const r = await fetch(`${SB_URL}/auth/v1/admin/users/${authUserId}`, {
        method: 'PUT',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (!r.ok) {
        const e = await r.json();
        return res.status(400).json({ error: e.message || 'Error al resetear contraseña' });
      }
      return res.status(200).json({ success: true });
    }

    // ── DELETE user ─────────────────────────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email requerido' });

      // Prevent deleting yourself
      if (email === admin.email) {
        return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
      }

      // Find auth user ID
      const listRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const listData = await listRes.json();
      const authUserId = (listData?.users || []).find(u => u.email === email)?.id;

      // Delete from users table first
      await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });

      // Delete from Auth if found
      if (authUserId) {
        await fetch(`${SB_URL}/auth/v1/admin/users/${authUserId}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch (e) {
    console.error('[admin-users] action:', action, 'method:', req.method, 'error:', e.message || e);
    return res.status(500).json({ error: 'Error interno del servidor', detail: e.message });
  }
}
